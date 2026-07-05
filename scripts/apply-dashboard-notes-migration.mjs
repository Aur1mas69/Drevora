import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const envPath = path.join(root, '.env.local')
const migrationPath = path.join(
  root,
  'supabase/migrations/20260705220000_create_dashboard_notes_table.sql',
)

function loadEnvFile(filePath) {
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

function getProjectRef(supabaseUrl) {
  try {
    return new URL(supabaseUrl).hostname.split('.')[0]
  } catch {
    return null
  }
}

function ensureSupabaseConfig() {
  const configDir = path.join(root, 'supabase')
  const configPath = path.join(configDir, 'config.toml')
  if (fs.existsSync(configPath)) return

  fs.mkdirSync(configDir, { recursive: true })
  execFileSync('npx', ['supabase', 'init'], { cwd: root, stdio: 'inherit' })
}

function runSupabase(args, extraEnv = {}) {
  execFileSync('npx', ['supabase', ...args], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  })
}

async function verifyTable(supabaseUrl, anonKey) {
  const client = createClient(supabaseUrl, anonKey)
  const { error } = await client.from('dashboard_notes').select('id').limit(1)

  if (error) {
    throw new Error(error.message)
  }
}

async function main() {
  if (!fs.existsSync(migrationPath)) {
    console.error('Migration file not found:', migrationPath)
    process.exit(1)
  }

  const env = loadEnvFile(envPath)
  const supabaseUrl = env.VITE_SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY
  const dbPassword =
    env.SUPABASE_DB_PASSWORD || env.DB_PASSWORD || env.POSTGRES_PASSWORD
  const projectRef = env.SUPABASE_PROJECT_REF || getProjectRef(supabaseUrl)

  if (!projectRef) {
    console.error('Could not determine Supabase project ref from VITE_SUPABASE_URL.')
    process.exit(1)
  }

  if (!dbPassword) {
    console.error(
      'Missing database password. Add SUPABASE_DB_PASSWORD to .env.local, then rerun:',
    )
    console.error('  node scripts/apply-dashboard-notes-migration.mjs')
    process.exit(1)
  }

  console.log('Applying dashboard_notes migration to project ref:', projectRef)
  ensureSupabaseConfig()
  runSupabase(['link', '--project-ref', projectRef, '--password', dbPassword])
  runSupabase(['db', 'execute', '--file', migrationPath])

  if (supabaseUrl && anonKey) {
    console.log('Verifying dashboard_notes table via Supabase API...')
    await verifyTable(supabaseUrl, anonKey)
    console.log('Verification succeeded: dashboard_notes is available.')
  } else {
    console.log('Skipped API verification (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing).')
  }

  console.log('Migration applied successfully.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
