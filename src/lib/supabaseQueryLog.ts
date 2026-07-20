type SupabaseQueryLogInput = {
  service: string
  table: string
  data: unknown[] | null
  error: { message: string; code?: string } | null
  count?: number | null
}

/**
 * Central Supabase query logger.
 * - Production: only real failures (console.error), no success/payload noise.
 * - Development: verbose table/row/data logs plus empty-result RLS hints.
 */
export function logSupabaseQuery({
  service,
  table,
  data,
  error,
  count,
}: SupabaseQueryLogInput): void {
  if (error) {
    console.error(`[${service}] public.${table} failed:`, {
      message: error.message,
      code: error.code,
    })
    return
  }

  if (!import.meta.env.DEV) {
    return
  }

  const rowCount = count ?? data?.length ?? 0

  console.log(`[${service}] table: public.${table}`)
  console.log(`[${service}] row count:`, rowCount)
  console.log(`[${service}] data:`, data)
  console.log(`[${service}] error:`, error)

  if (rowCount === 0) {
    console.warn(
      `[${service}] Query returned 0 rows for public.${table}. If data exists in the Supabase dashboard, RLS or table grants may be blocking reads. Run supabase/policies.sql against this project.`,
    )
  }
}

export function getSupabaseHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return 'invalid-url'
  }
}
