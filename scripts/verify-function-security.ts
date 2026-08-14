/**
 * Focused verification: function privilege regression guard.
 * Run: npm run verify:function-security
 *
 * Scans supabase/migrations/ in timestamp order and fails if a future
 * migration reintroduces anon/PUBLIC EXECUTE on DREVORA functions, or
 * opens drevora_private to anon/PUBLIC.
 *
 * Static / deterministic — does not call Supabase or apply SQL.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let passed = 0

function assertTrue(value: boolean, message: string) {
  if (!value) throw new Error(message)
}

function run(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`PASS  ${name}`)
}

function read(relative: string): string {
  return readFileSync(resolve(relative), 'utf8').replace(/\r\n/g, '\n')
}

const MIGRATIONS_DIR = 'supabase/migrations'
const PLATFORM_SCHEMAS = new Set([
  'auth',
  'storage',
  'realtime',
  'graphql',
  'graphql_public',
  'extensions',
  'cron',
  'supabase_functions',
  'vault',
  'net',
  'pgbouncer',
])

const ANON_EXECUTE_ALLOWLIST: string[] = []

type FnRef = {
  schema: string
  name: string
  args: string
}

type MigrationFile = {
  file: string
  raw: string
  sql: string
}

function stripSqlNoise(sql: string): string {
  let out = sql.replace(/\/\*[\s\S]*?\*\//g, ' ')
  out = out.replace(/--[^\n]*/g, ' ')
  return out.replace(/\s+/g, ' ')
}

function normalizeArgs(args: string): string {
  return args
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .split(',')
    .map((part) => {
      const tokens = part.trim().split(' ').filter(Boolean)
      if (tokens.length === 0) return ''
      if (tokens.length === 1) return tokens[0]
      return tokens.slice(1).join(' ')
    })
    .join(', ')
}

function nameKey(name: string, args: string): string {
  return `${name}(${normalizeArgs(args)})`
}

function extractParens(sql: string, openIndex: number): { inner: string; end: number } | null {
  if (sql[openIndex] !== '(') return null
  let depth = 0
  for (let i = openIndex; i < sql.length; i += 1) {
    const ch = sql[i]
    if (ch === '(') depth += 1
    else if (ch === ')') {
      depth -= 1
      if (depth === 0) return { inner: sql.slice(openIndex + 1, i), end: i }
    }
  }
  return null
}

function parseRoleList(roles: string): string[] {
  return roles
    .replace(/\s+with\s+grant\s+option\b/gi, '')
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean)
}

function roleListHasAnonOrPublic(roles: string): boolean {
  return parseRoleList(roles).some((r) => r === 'anon' || r === 'public')
}

function isDrevoraFunctionName(name: string): boolean {
  return /^drevora_[a-z0-9_]+$/.test(name)
}

function isTrackedSchema(schema: string): boolean {
  return schema === 'public' || schema === 'drevora_private'
}

function loadMigrations(): MigrationFile[] {
  return readdirSync(resolve(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => {
      const raw = read(`${MIGRATIONS_DIR}/${file}`)
      return { file, raw, sql: stripSqlNoise(raw) }
    })
}

function findCreateFunctions(sql: string): FnRef[] {
  const found: FnRef[] = []
  const re = /\bcreate(?:\s+or\s+replace)?\s+function\s+(?:([a-zA-Z_][\w]*)\.)?([a-zA-Z_][\w]*)\s*\(/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(sql)) !== null) {
    const parens = extractParens(sql, m.index + m[0].length - 1)
    if (!parens) continue
    const schema = (m[1] || 'public').toLowerCase()
    const name = m[2].toLowerCase()
    if (PLATFORM_SCHEMAS.has(schema)) continue
    if (!isTrackedSchema(schema)) continue
    found.push({
      schema,
      name,
      args: parens.inner,
    })
  }
  return found
}

function findSchemaMoves(sql: string): FnRef[] {
  const found: FnRef[] = []
  const re =
    /\balter\s+function\s+(?:([a-zA-Z_][\w]*)\.)?([a-zA-Z_][\w]*)\s*\(/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(sql)) !== null) {
    const parens = extractParens(sql, m.index + m[0].length - 1)
    if (!parens) continue
    const rest = sql.slice(parens.end + 1, parens.end + 80)
    const schemaMatch = /^\s*set\s+schema\s+([a-zA-Z_][\w]*)/i.exec(rest)
    if (!schemaMatch) continue
    const dest = schemaMatch[1].toLowerCase()
    if (dest !== 'drevora_private') continue
    const name = m[2].toLowerCase()
    found.push({
      schema: dest,
      name,
      args: parens.inner,
    })
  }
  return found
}

type PrivilegeStmt = {
  action: 'grant' | 'revoke'
  name: string
  args: string
  schema: string
  roles: string[]
}

function findFunctionPrivilegeStmts(sql: string): PrivilegeStmt[] {
  const found: PrivilegeStmt[] = []
  const re =
    /\b(grant|revoke)\s+(all(?:\s+privileges)?|execute)\s+on\s+function\s+(?:([a-zA-Z_][\w]*)\.)?([a-zA-Z_][\w]*)\s*\(/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(sql)) !== null) {
    const parens = extractParens(sql, m.index + m[0].length - 1)
    if (!parens) continue
    const rest = sql.slice(parens.end + 1, parens.end + 160)
    const target = /^\s*(to|from)\s+([^;]+)/i.exec(rest)
    if (!target) continue
    const schema = (m[3] || 'public').toLowerCase()
    if (PLATFORM_SCHEMAS.has(schema)) continue
    found.push({
      action: m[1].toLowerCase() as 'grant' | 'revoke',
      schema,
      name: m[4].toLowerCase(),
      args: parens.inner,
      roles: parseRoleList(target[2]),
    })
  }
  return found
}

function findBlanketFunctionGrants(sql: string): string[] {
  const hits: string[] = []
  const re =
    /\bgrant\s+(all(?:\s+privileges)?|execute)\s+on\s+all\s+functions\s+in\s+schema\s+([a-zA-Z_][\w]*)\s+to\s+([^;]+)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(sql)) !== null) {
    const schema = m[2].toLowerCase()
    if (PLATFORM_SCHEMAS.has(schema)) continue
    if (!roleListHasAnonOrPublic(m[3])) continue
    if (schema === 'public' || schema === 'drevora_private') {
      hits.push(`GRANT ${m[1]} ON ALL FUNCTIONS IN SCHEMA ${schema} TO ${m[3].trim()}`)
    }
  }
  return hits
}

function findPrivateSchemaGrants(sql: string): string[] {
  const hits: string[] = []
  const re =
    /\bgrant\s+((?:all(?:\s+privileges)?)|usage|create)(?:\s*,\s*(?:usage|create))*\s+on\s+schema\s+drevora_private\s+to\s+([^;]+)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(sql)) !== null) {
    if (roleListHasAnonOrPublic(m[2])) {
      hits.push(`GRANT ${m[1]} ON SCHEMA drevora_private TO ${m[2].trim()}`)
    }
  }
  return hits
}

function findDefaultPrivilegeGrants(sql: string): string[] {
  const hits: string[] = []
  const re =
    /\balter\s+default\s+privileges(?:\s+for\s+role\s+[a-zA-Z_][\w]*)?(?:\s+in\s+schema\s+([a-zA-Z_][\w]*))?\s+grant\s+execute\s+on\s+functions\s+to\s+([^;]+)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(sql)) !== null) {
    const schema = (m[1] || '').toLowerCase()
    if (schema && PLATFORM_SCHEMAS.has(schema)) continue
    if (!roleListHasAnonOrPublic(m[2])) continue
    if (!schema || schema === 'public' || schema === 'drevora_private') {
      hits.push(
        `ALTER DEFAULT PRIVILEGES${schema ? ` IN SCHEMA ${schema}` : ''} GRANT EXECUTE ON FUNCTIONS TO ${m[2].trim()}`,
      )
    }
  }
  return hits
}

function findDynamicAnonExecuteGrants(sql: string): string[] {
  const hits: string[] = []
  const re =
    /\bexecute\s+(?:format\s*)?\(\s*'grant\s+(?:all(?:\s+privileges)?|execute)\s+on\s+function[^']*to\s+(?:[^']*\b)?(?:anon|public)\b[^']*'/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(sql)) !== null) {
    hits.push(m[0].slice(0, 120))
  }
  return hits
}

function hasAnonAllowException(raw: string, name: string): boolean {
  const re = new RegExp(
    `function[_-]security[_-]allow[_-]anon[_-]execute\\s*:\\s*(?:public\\.)?${name}\\b`,
    'i',
  )
  return re.test(raw) || ANON_EXECUTE_ALLOWLIST.includes(name)
}

const migrations = loadMigrations()

type PrivateIntro = {
  file: string
  ref: FnRef
  revokedPublic: boolean
  revokedAnon: boolean
}

const privateIntros: PrivateIntro[] = []
const explicitAnonGrants: { file: string; key: string; superseded: boolean }[] = []
const blanketHits: { file: string; detail: string }[] = []
let privateMoveCount = 0
let privateCreateCount = 0

const anonGrantOutstanding = new Map<string, string>()
const knownPrivate = new Set<string>()

for (const migration of migrations) {
  const creates = findCreateFunctions(migration.sql)
  const moves = findSchemaMoves(migration.sql)
  const privs = findFunctionPrivilegeStmts(migration.sql)

  privateMoveCount += moves.length
  const newPrivateCreates = creates.filter((fn) => fn.schema === 'drevora_private')
  privateCreateCount += newPrivateCreates.length

  const intros = [...newPrivateCreates, ...moves].filter((ref) => {
    const key = nameKey(ref.name, ref.args)
    if (knownPrivate.has(key)) return false
    knownPrivate.add(key)
    return true
  })

  for (const intro of intros) {
    const nkey = nameKey(intro.name, intro.args)
    const revokedPublic = privs.some(
      (p) =>
        p.action === 'revoke' &&
        p.name === intro.name &&
        nameKey(p.name, p.args) === nkey &&
        p.roles.includes('public'),
    )
    const revokedAnon = privs.some(
      (p) =>
        p.action === 'revoke' &&
        p.name === intro.name &&
        nameKey(p.name, p.args) === nkey &&
        p.roles.includes('anon'),
    )
    privateIntros.push({
      file: migration.file,
      ref: intro,
      revokedPublic,
      revokedAnon,
    })
  }

  for (const stmt of privs) {
    if (!isDrevoraFunctionName(stmt.name)) continue
    const key = nameKey(stmt.name, stmt.args)
    const touchesAnon = stmt.roles.includes('anon')
    if (stmt.action === 'grant' && touchesAnon && stmt.schema === 'public') {
      if (hasAnonAllowException(migration.raw, stmt.name)) continue
      anonGrantOutstanding.set(key, migration.file)
    }
    if (stmt.action === 'revoke' && touchesAnon) {
      anonGrantOutstanding.delete(key)
    }
  }

  for (const detail of [
    ...findBlanketFunctionGrants(migration.sql),
    ...findPrivateSchemaGrants(migration.sql),
    ...findDefaultPrivilegeGrants(migration.sql),
    ...findDynamicAnonExecuteGrants(migration.raw),
  ]) {
    blanketHits.push({ file: migration.file, detail })
  }
}

for (const [key, file] of anonGrantOutstanding) {
  explicitAnonGrants.push({ file, key, superseded: false })
}

run('1. Migration directory is readable and timestamp-ordered', () => {
  assertTrue(migrations.length > 0, 'found SQL migrations')
  const names = migrations.map((m) => m.file)
  const sorted = [...names].sort()
  assertTrue(
    names.every((n, i) => n === sorted[i]),
    'migrations are processed in filename order',
  )
})

run('2. Parser finds historical drevora_private SET SCHEMA introductions', () => {
  assertTrue(
    privateMoveCount >= 24,
    `expected at least 24 ALTER FUNCTION ... SET SCHEMA drevora_private, found ${privateMoveCount}`,
  )
  assertTrue(
    privateIntros.length >= 24,
    `expected at least 24 private introductions to harden, found ${privateIntros.length}`,
  )
})

run('3. Rule A — new/moved drevora_private functions revoke PUBLIC and anon EXECUTE', () => {
  const missing = privateIntros.filter((intro) => !intro.revokedPublic || !intro.revokedAnon)
  assertTrue(
    missing.length === 0,
    missing
      .map(
        (m) =>
          `${m.file}: ${m.ref.name}(${normalizeArgs(m.ref.args)}) missing ${[
            !m.revokedPublic ? 'REVOKE FROM PUBLIC' : '',
            !m.revokedAnon ? 'REVOKE FROM anon' : '',
          ]
            .filter(Boolean)
            .join(' and ')}`,
      )
      .join('\n'),
  )
})

run('4. Rule B — no un-superseded GRANT EXECUTE on public.drevora_* TO anon', () => {
  assertTrue(
    ANON_EXECUTE_ALLOWLIST.length === 0,
    'allowlist must stay empty unless a documented anonymous RPC is added',
  )
  assertTrue(
    explicitAnonGrants.length === 0,
    explicitAnonGrants
      .map((g) => `${g.file}: GRANT EXECUTE TO anon on ${g.key}`)
      .join('\n'),
  )
})

run('5. Rule C — no blanket anon/PUBLIC function or drevora_private schema grants', () => {
  assertTrue(
    blanketHits.length === 0,
    blanketHits.map((h) => `${h.file}: ${h.detail}`).join('\n'),
  )
})

run('6. Scope stays on DREVORA public / drevora_private (platform schemas ignored)', () => {
  const platformCreate = migrations.flatMap((m) =>
    findCreateFunctions(m.sql).filter((fn) => PLATFORM_SCHEMAS.has(fn.schema)),
  )
  assertTrue(platformCreate.length === 0, 'platform-schema creates must be ignored by parser')
  const defaultHits = migrations.flatMap((m) => findDefaultPrivilegeGrants(m.sql))
  assertTrue(defaultHits.length === 0, 'no DREVORA default EXECUTE grants to anon/PUBLIC')
})

run('7. Current intended state — no anonymous DREVORA RPCs and no private creates without revoke', () => {
  assertTrue(privateCreateCount === 0 || privateIntros.every((i) => i.revokedAnon && i.revokedPublic), 'private creates are hardened')
  assertTrue(
    !migrations.some((m) =>
      /grant\s+usage\s+on\s+schema\s+drevora_private\s+to\s+(anon|public)\b/i.test(m.sql),
    ),
    'drevora_private USAGE is not granted to anon/PUBLIC',
  )
})

console.log(`\nAll ${passed} checks passed.`)
console.log(
  `Scanned ${migrations.length} migrations; ${privateMoveCount} private schema moves; ${privateCreateCount} direct private creates.`,
)
