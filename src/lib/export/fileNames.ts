/** Sanitize a single path segment for download file names. */
export function sanitizeFileNamePart(value: string, maxLength = 60): string {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return (cleaned || 'export').slice(0, maxLength)
}

type BuildExportFileNameInput = {
  module: string
  parts?: Array<string | null | undefined>
  extension: 'xlsx' | 'pdf' | 'zip'
}

/** Build a predictable DREVORA_* file name without database IDs. */
export function buildExportFileName(input: BuildExportFileNameInput): string {
  const modulePart = sanitizeFileNamePart(input.module, 40)
  const extra = (input.parts ?? [])
    .map((part) => (part == null ? '' : String(part).trim()))
    .filter(Boolean)
    .map((part) => sanitizeFileNamePart(part, 40))

  const stem = ['DREVORA', modulePart, ...extra].join('_')
  return `${stem}.${input.extension}`
}

/** Ensure ZIP entry names stay unique when stems collide. */
export function uniquifyFileNames(fileNames: string[]): string[] {
  const used = new Map<string, number>()

  return fileNames.map((name) => {
    const dot = name.lastIndexOf('.')
    const stem = dot > 0 ? name.slice(0, dot) : name
    const ext = dot > 0 ? name.slice(dot) : ''
    const count = used.get(stem) ?? 0
    used.set(stem, count + 1)
    if (count === 0) return name
    return `${stem}-${count}${ext}`
  })
}
