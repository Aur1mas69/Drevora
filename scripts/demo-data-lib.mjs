/**
 * Shared helpers for DREVORA demo seed / remove scripts.
 * Server-only — never import from Vite/React.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(__dirname, '..')
export const MANIFEST_PATH = path.join(ROOT, 'scripts', '.demo-data-manifest.json')

export const DEMO_EMAIL_DOMAIN = 'demo.drevora.local'
export const DEMO_FLEET_PREFIX = 'DEMO-'
export const DEMO_SEED = 0x44_52_45_56 // DREV

export const EMPTY_MANIFEST = () => ({
  version: 2,
  createdAt: null,
  companyId: null,
  companyName: null,
  companyCreatedBySeed: false,
  vehicleIds: [],
  driverIds: [],
  timesheetIds: [],
  timesheetEntryIds: [],
  holidayRequestIds: [],
  driverReportIds: [],
  vehicleCheckIds: [],
  vehicleCheckItemIds: [],
})

export function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const values = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator <= 0) continue
    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    values[key] = value
  }
  return values
}

export function resolveEnv() {
  const fileEnv = {
    ...loadEnvFile(path.join(ROOT, '.env')),
    ...loadEnvFile(path.join(ROOT, '.env.local')),
  }
  const env = { ...fileEnv, ...process.env }

  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error(
      'Missing SUPABASE_URL (or VITE_SUPABASE_URL). Add it to .env.local — do not commit secrets.',
    )
  }
  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local for local scripts only. Never use VITE_* for the service role key.',
    )
  }
  if (env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Refuse to run: VITE_SUPABASE_SERVICE_ROLE_KEY must not exist. Service role keys must never be exposed to the Vite client.',
    )
  }

  return { supabaseUrl, serviceRoleKey, env }
}

export function createServiceClient() {
  const { supabaseUrl, serviceRoleKey } = resolveEnv()
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Deterministic mulberry32 PRNG */
export function createRng(seed = DEMO_SEED) {
  let state = seed >>> 0
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    int(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min
    },
    pick(list) {
      return list[this.int(0, list.length - 1)]
    },
    shuffle(list) {
      const copy = [...list]
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = this.int(0, i)
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
      }
      return copy
    },
  }
}

export function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return null
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
}

export function writeManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

export function deleteManifest() {
  if (fs.existsSync(MANIFEST_PATH)) fs.unlinkSync(MANIFEST_PATH)
}

/**
 * Resolve the company that should receive demo data.
 * - Exactly 1 company → use it
 * - 0 companies → error
 * - >1 companies → require DEMO_TARGET_COMPANY_ID (never silent pick)
 */
export async function resolveTargetCompany(client, env = process.env) {
  const { data: companies, error } = await client
    .from('companies')
    .select('id, name, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to query companies: ${error.message}`)
  }

  const rows = companies ?? []
  if (rows.length === 0) {
    throw new Error(
      'No companies found in public.companies. Create a company in Settings first, then re-run the seed.',
    )
  }

  if (rows.length === 1) {
    const company = rows[0]
    const name = company.name?.trim() || '(unnamed company)'
    return {
      id: company.id,
      name,
      scopeName: company.name?.trim() || name,
      createdAt: company.created_at,
      selection: 'single-company',
    }
  }

  const explicitId = (env.DEMO_TARGET_COMPANY_ID || '').trim()
  if (!explicitId) {
    const list = rows
      .map((row) => `  - ${row.id}  ${row.name?.trim() || '(unnamed)'}`)
      .join('\n')
    throw new Error(
      `Found ${rows.length} companies. Set DEMO_TARGET_COMPANY_ID to the exact company UUID before seeding.\n${list}`,
    )
  }

  const match = rows.find((row) => row.id === explicitId)
  if (!match) {
    throw new Error(
      `DEMO_TARGET_COMPANY_ID=${explicitId} does not match any row in public.companies.`,
    )
  }

  const name = match.name?.trim() || '(unnamed company)'
  return {
    id: match.id,
    name,
    scopeName: match.name?.trim() || name,
    createdAt: match.created_at,
    selection: 'explicit-DEMO_TARGET_COMPANY_ID',
  }
}

export async function chunkedInsert(client, table, rows, chunkSize = 50) {
  const ids = []
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { data, error } = await client.from(table).insert(chunk).select('id')
    if (error) {
      throw new Error(`Insert into ${table} failed: ${error.message}`)
    }
    for (const row of data ?? []) ids.push(row.id)
  }
  return ids
}

export function chunkedDeleteByIds(client, table, ids, chunkSize = 100) {
  return (async () => {
    if (!ids?.length) return 0
    let deleted = 0
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize)
      const { error, count } = await client.from(table).delete({ count: 'exact' }).in('id', chunk)
      if (error) {
        throw new Error(`Delete from ${table} failed: ${error.message}`)
      }
      deleted += count ?? chunk.length
    }
    return deleted
  })()
}

export function pad2(n) {
  return String(n).padStart(2, '0')
}

export function toDateString(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

export function addDays(date, days) {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function startOfUtcMonday(from = new Date()) {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDays(d, diff)
}

export function minutesBetween(startHHMM, finishHHMM) {
  const [sh, sm] = startHHMM.split(':').map(Number)
  const [fh, fm] = finishHHMM.split(':').map(Number)
  let startM = sh * 60 + sm
  let finishM = fh * 60 + fm
  if (finishM <= startM) finishM += 24 * 60
  return finishM - startM
}

export const WORKER_CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
export const WORKER_CODE_DIGITS = '23456789'

export function makeWorkerCode(rng, index) {
  const chars = []
  chars.push(WORKER_CODE_LETTERS[index % WORKER_CODE_LETTERS.length])
  chars.push(WORKER_CODE_DIGITS[index % WORKER_CODE_DIGITS.length])
  while (chars.length < 5) {
    chars.push(
      rng.next() < 0.5
        ? WORKER_CODE_LETTERS[rng.int(0, WORKER_CODE_LETTERS.length - 1)]
        : WORKER_CODE_DIGITS[rng.int(0, WORKER_CODE_DIGITS.length - 1)],
    )
  }
  return rng.shuffle(chars).join('')
}

export function parseArgs(argv = process.argv.slice(2)) {
  return {
    dryRun: argv.includes('--dry-run') || argv.includes('--validate'),
    rebuildManifest: argv.includes('--rebuild-manifest'),
  }
}

export function sectionComplete(manifest, key, expectedMin = 1) {
  const ids = manifest?.[key]
  return Array.isArray(ids) && ids.length >= expectedMin
}

export function printManifestStatus(manifest) {
  const rows = [
    ['companyId', manifest?.companyId ? 1 : 0, 1],
    ['vehicleIds', manifest?.vehicleIds?.length ?? 0, 35],
    ['driverIds', manifest?.driverIds?.length ?? 0, 30],
    ['timesheetIds', manifest?.timesheetIds?.length ?? 0, 100],
    ['timesheetEntryIds', manifest?.timesheetEntryIds?.length ?? 0, 700],
    ['holidayRequestIds', manifest?.holidayRequestIds?.length ?? 0, 20],
    ['driverReportIds', manifest?.driverReportIds?.length ?? 0, 20],
    ['vehicleCheckIds', manifest?.vehicleCheckIds?.length ?? 0, 40],
    ['vehicleCheckItemIds', manifest?.vehicleCheckItemIds?.length ?? 0, 1],
  ]
  for (const [key, count, expected] of rows) {
    const ok = count >= expected
    console.log(`  ${ok ? 'OK ' : 'MISS'} ${key}: ${count}${expected > 1 ? ` (need ≥${expected})` : ''}`)
  }
}
