import { downloadBlob } from '@/lib/export/downloadBlob'

export type ExcelColumn = {
  header: string
  key: string
  width?: number
  wrap?: boolean
}

export type ExcelSheetDefinition = {
  name: string
  columns: ExcelColumn[]
  rows: Array<Record<string, string | number | null | undefined>>
}

export async function buildExcelWorkbookBlob(sheets: ExcelSheetDefinition[]): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'DREVORA'
  workbook.created = new Date()

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name.slice(0, 31) || 'Sheet1')
    worksheet.columns = sheet.columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: column.width ?? 16,
      style: column.wrap ? { alignment: { wrapText: true, vertical: 'top' } } : undefined,
    }))

    for (const row of sheet.rows) {
      const values: Record<string, string | number> = {}
      for (const column of sheet.columns) {
        const raw = row[column.key]
        values[column.key] = raw == null || raw === '' ? '—' : raw
      }
      worksheet.addRow(values)
    }

    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.alignment = { vertical: 'middle', wrapText: true }
    worksheet.views = [{ state: 'frozen', ySplit: 1 }]

    if (sheet.rows.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheet.columns.length },
      }
    }

    for (const column of sheet.columns) {
      if (!column.wrap) continue
      worksheet.getColumn(column.key).alignment = { wrapText: true, vertical: 'top' }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export async function downloadExcelWorkbook(
  sheets: ExcelSheetDefinition[],
  fileName: string,
): Promise<void> {
  const blob = await buildExcelWorkbookBlob(sheets)
  downloadBlob(blob, fileName)
}

export function excelEmpty(value: string | number | null | undefined): string {
  if (value == null) return '—'
  const text = String(value).trim()
  return text || '—'
}
