import type { ExportMeta } from '@/lib/export/exportMeta'
import {
  createBrandedPdf,
  PDF_CONTENT_WIDTH,
  PDF_FOOTER_Y,
  PDF_MARGIN,
  pdfText,
} from '@/lib/export/pdfDocument'
import { formatDateFromIso, formatDateTimeFromIso } from '@/lib/dateTimeFormat'
import {
  formatVehicleCheckAccuracy,
  formatVehicleCheckCoordinatePair,
} from '@/lib/vehicleCheckLocation'
import {
  getVehicleCheckReportIdentity,
  groupVehicleCheckReportItems,
} from '@/lib/vehicleCheckReportGrouping'
import type { VehicleCheck } from '@/lib/vehicleCheckTypes'
import {
  formatDefectReviewStatusLabel,
  formatVehicleCheckItemResultLabel,
  formatVehicleCheckReference,
  formatVehicleCheckResultLabel,
  resolveInspectionResult,
} from '@/lib/vehicleCheckUtils'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const NAVY_DEEP: [number, number, number] = [11, 38, 70]
const NAVY: [number, number, number] = [17, 60, 105]
const ACCENT: [number, number, number] = [33, 142, 231]
const LABEL: [number, number, number] = [90, 115, 138]
const MUTED: [number, number, number] = [100, 116, 139]
const RULE: [number, number, number] = [210, 222, 234]
const HEAD_BG: [number, number, number] = [241, 246, 251]
const ROW_ALT: [number, number, number] = [248, 251, 253]
const GREEN: [number, number, number] = [22, 122, 64]
const GREEN_BG: [number, number, number] = [240, 253, 244]
const RED: [number, number, number] = [185, 28, 28]
const RED_BG: [number, number, number] = [254, 242, 242]
const RED_RULE: [number, number, number] = [252, 165, 165]

const HEADER_HEIGHT = 22
const CONTINUATION_HEADER_HEIGHT = 10
const CONTENT_BOTTOM = PDF_FOOTER_Y - 8

export type VehicleCheckPdfPhotoAsset = {
  caption: string
  dataUrl: string | null
  naturalWidth: number
  naturalHeight: number
}

export type VehicleCheckPdfAssets = {
  logoDataUrl: string | null
  photos: VehicleCheckPdfPhotoAsset[]
  signature: VehicleCheckPdfPhotoAsset | null
}

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } }

type InfoColumn = {
  title: string
  fields: Array<{ label: string; value: string }>
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins <= 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

function formatPdfLocation(location: VehicleCheck['startedLocation']): string {
  const pair = formatVehicleCheckCoordinatePair(location.latitude, location.longitude)
  if (!pair) return 'Unavailable'
  const accuracy = formatVehicleCheckAccuracy(location.accuracy)
  return accuracy === '—' ? pair : `${pair} (${accuracy})`
}

function mileageValue(check: VehicleCheck): string {
  if (check.odometer == null) return '—'
  return `${check.odometer} ${check.odometerUnit}`
}

function imageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) {
    return 'JPEG'
  }
  return 'PNG'
}

function isUsableEvidenceImage(
  dataUrl: string | null | undefined,
  logoDataUrl: string | null,
): dataUrl is string {
  if (!dataUrl?.startsWith('data:image/')) return false
  if (logoDataUrl && dataUrl === logoDataUrl) return false
  return true
}

function addContainedImage(
  doc: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  boxWidth: number,
  boxHeight: number,
  naturalWidth: number,
  naturalHeight: number,
  alias: string,
  align: 'left' | 'center' = 'center',
): { width: number; height: number } {
  const size = fitContain(naturalWidth, naturalHeight, boxWidth, boxHeight)
  const imageX = align === 'left' ? x : x + (boxWidth - size.width) / 2
  const imageY = y + (boxHeight - size.height) / 2
  doc.addImage(
    dataUrl,
    imageFormat(dataUrl),
    imageX,
    imageY,
    size.width,
    size.height,
    alias,
    'NONE',
  )
  return size
}

function fitContain(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const ratio = Math.max(naturalWidth, 1) / Math.max(naturalHeight, 1)
  let width = maxWidth
  let height = width / ratio
  if (height > maxHeight) {
    height = maxHeight
    width = height * ratio
  }
  return { width, height }
}

function logoNaturalSize(dataUrl: string): { width: number; height: number } {
  try {
    const comma = dataUrl.indexOf(',')
    const binary = atob(dataUrl.slice(comma + 1))
    if (binary.startsWith('\x89PNG')) {
      const view = new DataView(
        Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer,
      )
      return { width: view.getUint32(16), height: view.getUint32(20) }
    }
  } catch {
    // Fall through to the known full-logo ratio.
  }
  return { width: 1336, height: 424 }
}

function collectRecordBanners(check: VehicleCheck): string[] {
  const banners: string[] = []
  if (check.originalCheckId) {
    banners.push('Corrected record')
  } else if (check.linkedCorrectionCount > 0) {
    banners.push('Original check')
  }
  if (check.defectCount > 0 && check.defectReviewedAt) {
    banners.push('Manager reviewed')
  }
  return banners
}

function drawContinuationHeader(doc: jsPDF, title: string, subtitle: string): void {
  doc.setDrawColor(...RULE)
  doc.setLineWidth(0.3)
  doc.line(PDF_MARGIN, CONTINUATION_HEADER_HEIGHT - 1.2, PDF_MARGIN + PDF_CONTENT_WIDTH, CONTINUATION_HEADER_HEIGHT - 1.2)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...NAVY_DEEP)
  doc.text(title, PDF_MARGIN, 6.2)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...LABEL)
  doc.text(subtitle, 210 - PDF_MARGIN, 6.2, { align: 'right' })
}

function ensureSpace(
  doc: jsPDF,
  y: number,
  neededMm: number,
  continuation: { title: string; subtitle: string },
): number {
  if (y + neededMm <= CONTENT_BOTTOM) return y
  doc.addPage()
  drawContinuationHeader(doc, continuation.title, continuation.subtitle)
  return CONTINUATION_HEADER_HEIGHT + 5
}

function renderSectionHeading(doc: jsPDF, title: string, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(title, PDF_MARGIN, y)
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.45)
  doc.line(PDF_MARGIN, y + 1.3, PDF_MARGIN + 14, y + 1.3)
  return y + 5
}

function renderReportHeader(
  doc: jsPDF,
  check: VehicleCheck,
  identity: ReturnType<typeof getVehicleCheckReportIdentity>,
  logoDataUrl: string | null,
): number {
  const rightX = 210 - PDF_MARGIN
  let logoWidth = 0

  if (logoDataUrl) {
    try {
      const natural = logoNaturalSize(logoDataUrl)
      const size = addContainedImage(
        doc,
        logoDataUrl,
        PDF_MARGIN,
        3.4,
        56,
        16,
        natural.width,
        natural.height,
        'drevora-header-logo',
        'left',
      )
      logoWidth = size.width
    } catch {
      // Logo optional — title block remains.
    }
  }

  if (logoWidth < 8) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...NAVY_DEEP)
    doc.text('DREVORA', PDF_MARGIN, 10)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...NAVY_DEEP)
  doc.text('VEHICLE CHECK REPORT', rightX, 8.2, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text(identity.vehicle.registration, rightX, 13.4, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.4)
  doc.setTextColor(...LABEL)
  doc.text(
    `${formatDateFromIso(check.inspectionDate)}  ·  Ref ${formatVehicleCheckReference(check.id)}`,
    rightX,
    18.2,
    { align: 'right' },
  )

  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.7)
  doc.line(PDF_MARGIN, HEADER_HEIGHT, PDF_MARGIN + PDF_CONTENT_WIDTH, HEADER_HEIGHT)
  return HEADER_HEIGHT + 5
}

function renderRecordBanners(doc: jsPDF, y: number, banners: string[]): number {
  if (banners.length === 0) return y
  let x = PDF_MARGIN
  banners.forEach((banner) => {
    const isCorrection = banner.toLowerCase().includes('corrected')
    const fg = isCorrection ? RED : NAVY
    const bg = isCorrection ? RED_BG : HEAD_BG
    const width = doc.getTextWidth(banner) + 6
    doc.setFillColor(...bg)
    doc.setDrawColor(...(isCorrection ? RED_RULE : RULE))
    doc.setLineWidth(0.2)
    doc.roundedRect(x, y, width, 5.2, 0.6, 0.6, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.2)
    doc.setTextColor(...fg)
    doc.text(banner, x + 3, y + 3.5)
    x += width + 2.2
  })
  return y + 8
}

function renderInfoColumns(doc: jsPDF, y: number, columns: InfoColumn[]): number {
  const gap = 4
  const colWidth = (PDF_CONTENT_WIDTH - gap * (columns.length - 1)) / columns.length
  const titleH = 5
  const rowH = 6.1
  const heights = columns.map((column) => titleH + column.fields.length * rowH)
  const blockH = Math.max(...heights)

  columns.forEach((column, index) => {
    const x = PDF_MARGIN + index * (colWidth + gap)
    if (index > 0) {
      doc.setDrawColor(...RULE)
      doc.setLineWidth(0.2)
      doc.line(x - gap / 2, y, x - gap / 2, y + blockH - 1)
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.4)
    doc.setTextColor(...NAVY)
    doc.text(column.title.toUpperCase(), x, y + 3)

    column.fields.forEach((field, fieldIndex) => {
      const fieldY = y + titleH + 1.2 + fieldIndex * rowH
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(5.6)
      doc.setTextColor(...LABEL)
      doc.text(field.label.toUpperCase(), x, fieldY)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.3)
      doc.setTextColor(...NAVY_DEEP)
      const lines = doc.splitTextToSize(field.value || '—', colWidth - 1.5)
      doc.text(lines.slice(0, 2), x, fieldY + 2.8)
    })
  })

  doc.setDrawColor(...RULE)
  doc.setLineWidth(0.25)
  doc.line(PDF_MARGIN, y + blockH + 1.2, PDF_MARGIN + PDF_CONTENT_WIDTH, y + blockH + 1.2)
  return y + blockH + 5
}

function renderDefects(
  doc: jsPDF,
  y: number,
  report: ReturnType<typeof groupVehicleCheckReportItems>,
  continuation: { title: string; subtitle: string },
): number {
  y = ensureSpace(doc, y, 16, continuation)
  y = renderSectionHeading(doc, 'Issues requiring attention', y)

  const defectEntries = report.numberedItems.filter((entry) => entry.item.result === 'Advisory')
  if (defectEntries.length === 0) {
    doc.setFillColor(...GREEN_BG)
    doc.roundedRect(PDF_MARGIN, y, PDF_CONTENT_WIDTH, 6.4, 0.7, 0.7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.4)
    doc.setTextColor(...GREEN)
    doc.text('No defects reported', PDF_MARGIN + 2.4, y + 4.2)
    return y + 9
  }

  for (const entry of defectEntries) {
    const note = entry.item.comment?.trim() || 'No note provided'
    const title = `${String(entry.displayNumber).padStart(2, '0')}  ${entry.item.itemName}`
    const titleLines = doc.splitTextToSize(title, PDF_CONTENT_WIDTH - 6)
    const noteLines = doc.splitTextToSize(`Defect · ${note}`, PDF_CONTENT_WIDTH - 6)
    const boxH = 4.2 + titleLines.length * 3.4 + Math.min(noteLines.length, 3) * 3.2
    y = ensureSpace(doc, y, boxH + 2, continuation)

    doc.setFillColor(...RED_BG)
    doc.setDrawColor(...RED_RULE)
    doc.setLineWidth(0.25)
    doc.roundedRect(PDF_MARGIN, y, PDF_CONTENT_WIDTH, boxH, 0.7, 0.7, 'FD')
    doc.setFillColor(...RED)
    doc.rect(PDF_MARGIN, y, 1.1, boxH, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.6)
    doc.setTextColor(...NAVY_DEEP)
    doc.text(titleLines.slice(0, 2), PDF_MARGIN + 3.2, y + 3.6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...RED)
    doc.text(
      noteLines.slice(0, 3),
      PDF_MARGIN + 3.2,
      y + 3.6 + titleLines.slice(0, 2).length * 3.4,
    )
    y += boxH + 1.8
  }

  return y + 1.5
}

function renderChecklistSection(
  doc: jsPDF,
  y: number,
  sectionTitle: string,
  subtitle: string | null,
  rows: string[][],
  continuation: { title: string; subtitle: string },
): number {
  const headingNeed = subtitle ? 22 : 18
  y = ensureSpace(doc, y, headingNeed, continuation)
  y = renderSectionHeading(doc, sectionTitle, y)

  if (subtitle) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(6.6)
    doc.setTextColor(...LABEL)
    const hint = doc.splitTextToSize(subtitle, PDF_CONTENT_WIDTH)
    doc.text(hint.slice(0, 2), PDF_MARGIN, y)
    y += hint.slice(0, 2).length * 3 + 1
  }

  autoTable(doc, {
    startY: y,
    head: [['#', 'Item', 'Result', 'Notes']],
    body: rows,
    margin: {
      left: PDF_MARGIN,
      right: PDF_MARGIN,
      top: CONTINUATION_HEADER_HEIGHT + 5,
      bottom: 18,
    },
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: { top: 1.15, right: 1.2, bottom: 1.15, left: 1.2 },
      textColor: NAVY,
      lineColor: RULE,
      lineWidth: 0.12,
      overflow: 'linebreak',
      valign: 'middle',
      minCellHeight: 5.2,
    },
    headStyles: {
      fillColor: HEAD_BG,
      textColor: NAVY,
      fontStyle: 'bold',
      fontSize: 6.6,
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 82 },
      2: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 77 },
    },
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const row = Array.isArray(data.row.raw) ? data.row.raw : null
      const result = String(row?.[2] ?? (data.column.index === 2 ? data.cell.raw : '') ?? '')
      if (result === 'Defect') {
        data.cell.styles.fillColor = RED_BG
      }
      if (data.column.index !== 2) return
      if (result === 'OK') data.cell.styles.textColor = GREEN
      if (result === 'Defect') data.cell.styles.textColor = RED
      if (result === 'N/A') data.cell.styles.textColor = MUTED
    },
    willDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawContinuationHeader(doc, continuation.title, continuation.subtitle)
      }
    },
  })

  return ((doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? y) + 4.2
}

function renderManagerReview(
  doc: jsPDF,
  y: number,
  check: VehicleCheck,
  reviewLabel: string,
  continuation: { title: string; subtitle: string },
): number {
  y = ensureSpace(doc, y, 22, continuation)
  y = renderSectionHeading(doc, 'Manager review', y)

  const fields = [
    { label: 'Review status', value: reviewLabel },
    { label: 'Reviewed by', value: pdfText(check.defectReviewedByName) },
    {
      label: 'Reviewed at',
      value: check.defectReviewedAt ? formatDateTimeFromIso(check.defectReviewedAt) : '—',
    },
  ]

  const colW = PDF_CONTENT_WIDTH / 3
  fields.forEach((field, index) => {
    const x = PDF_MARGIN + index * colW
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.6)
    doc.setTextColor(...LABEL)
    doc.text(field.label.toUpperCase(), x, y)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.6)
    doc.setTextColor(...NAVY_DEEP)
    doc.text(doc.splitTextToSize(field.value, colW - 3).slice(0, 2), x, y + 3.4)
  })
  y += 10

  if (check.defectReviewNotes?.trim()) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.6)
    doc.setTextColor(...LABEL)
    doc.text('REVIEW NOTES', PDF_MARGIN, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.4)
    doc.setTextColor(...NAVY)
    const notes = doc.splitTextToSize(check.defectReviewNotes.trim(), PDF_CONTENT_WIDTH)
    doc.text(notes, PDF_MARGIN, y + 3.4)
    y += notes.length * 3.4 + 5
  }

  return y + 2
}

function renderWorkerSignature(
  doc: jsPDF,
  y: number,
  check: VehicleCheck,
  identity: ReturnType<typeof getVehicleCheckReportIdentity>,
  signature: VehicleCheckPdfPhotoAsset | null,
  logoDataUrl: string | null,
  continuation: { title: string; subtitle: string },
): number {
  y = ensureSpace(doc, y, 28, continuation)
  y = renderSectionHeading(doc, 'Worker signature', y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.6)
  doc.setTextColor(...LABEL)
  doc.text('WORKER NAME', PDF_MARGIN, y)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...NAVY_DEEP)
  doc.text(pdfText(identity.workerName), PDF_MARGIN, y + 3.6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.6)
  doc.setTextColor(...LABEL)
  doc.text('SIGNED AT', PDF_MARGIN + 70, y)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...NAVY_DEEP)
  doc.text(check.signedAt ? formatDateTimeFromIso(check.signedAt) : '—', PDF_MARGIN + 70, y + 3.6)

  y += 7
  const imageY = y
  if (signature && isUsableEvidenceImage(signature.dataUrl, logoDataUrl)) {
    try {
      const size = addContainedImage(
        doc,
        signature.dataUrl,
        PDF_MARGIN,
        imageY,
        72,
        24,
        signature.naturalWidth,
        signature.naturalHeight,
        'worker-signature',
        'left',
      )
      y += size.height + 3
    } catch {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...MUTED)
      doc.text('No signature captured', PDF_MARGIN, imageY + 4)
      y += 8
    }
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text('No signature captured', PDF_MARGIN, imageY + 4)
    y += 8
  }

  return y
}

function addReportFooters(doc: jsPDF, meta: ExportMeta, reference: string): void {
  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(...RULE)
    doc.setLineWidth(0.2)
    doc.line(PDF_MARGIN, PDF_FOOTER_Y - 4.2, PDF_MARGIN + PDF_CONTENT_WIDTH, PDF_FOOTER_Y - 4.2)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.4)
    doc.setTextColor(...LABEL)
    doc.text('Generated by DREVORA', PDF_MARGIN, PDF_FOOTER_Y)
    doc.text(meta.companyName, PDF_MARGIN + PDF_CONTENT_WIDTH / 2, PDF_FOOTER_Y, {
      align: 'center',
    })
    doc.text(`Page ${page} of ${pageCount}`, PDF_MARGIN + PDF_CONTENT_WIDTH, PDF_FOOTER_Y, {
      align: 'right',
    })
    doc.setFontSize(5.8)
    doc.text(`${meta.generatedAtLabel}  ·  Ref ${reference}`, PDF_MARGIN, PDF_FOOTER_Y + 3.4)
  }
}

/**
 * Presentation-only Vehicle Check PDF. Uses existing check values unchanged.
 */
export function renderVehicleCheckPdfDocument(
  check: VehicleCheck,
  meta: ExportMeta,
  assets: VehicleCheckPdfAssets,
): jsPDF {
  const doc = createBrandedPdf()
  const inspectionResult = formatVehicleCheckResultLabel(
    resolveInspectionResult(check.overallResult, check.defectCount),
  )
  const reviewLabel = formatDefectReviewStatusLabel(
    check.defectReviewStatus,
    check.defectCount,
  )
  const identity = getVehicleCheckReportIdentity(check)
  const report = groupVehicleCheckReportItems(check.items)
  const reference = formatVehicleCheckReference(check.id)
  const continuation = {
    title: 'VEHICLE CHECK REPORT',
    subtitle: `${identity.vehicle.registration}  ·  Ref ${reference}`,
  }

  let y = renderReportHeader(doc, check, identity, assets.logoDataUrl)
  y = renderRecordBanners(doc, y, collectRecordBanners(check))

  const inspectionFields = [
    { label: 'Result', value: inspectionResult },
    { label: 'Inspection date', value: formatDateFromIso(check.inspectionDate) },
    { label: 'Submitted', value: formatDateTimeFromIso(check.createdAt) },
    { label: 'Duration', value: formatDuration(check.durationSeconds) },
    { label: 'Start location', value: formatPdfLocation(check.startedLocation) },
    { label: 'Completion location', value: formatPdfLocation(check.completedLocation) },
    {
      label: 'Checklist',
      value: `${report.summary.ok} OK · ${report.summary.defect} defect${
        report.summary.defect === 1 ? '' : 's'
      } · ${report.summary.na} N/A`,
    },
  ]
  if (check.originalCheckId) {
    inspectionFields.push({
      label: 'Correction of',
      value: formatVehicleCheckReference(check.originalCheckId),
    })
  }
  if (check.correctionReason?.trim()) {
    inspectionFields.push({
      label: 'Correction reason',
      value: check.correctionReason.trim(),
    })
  }

  const columns: InfoColumn[] = [
    {
      title: 'Vehicle',
      fields: [
        { label: 'Registration', value: pdfText(identity.vehicle.registration) },
        { label: 'Fleet number', value: pdfText(identity.vehicle.fleetNumber) },
        { label: 'Make / model', value: pdfText(identity.vehicle.makeModel) },
        { label: 'Vehicle type', value: pdfText(identity.vehicle.vehicleType) },
        { label: 'Mileage', value: mileageValue(check) },
      ],
    },
    {
      title: 'Worker',
      fields: [{ label: 'Worker name', value: pdfText(identity.workerName) }],
    },
  ]

  if (identity.trailer) {
    columns.push({
      title: 'Trailer',
      fields: identity.trailer.isThirdParty
        ? [
            { label: 'Source', value: 'Third-party' },
            { label: 'Trailer number', value: pdfText(identity.trailer.number) },
            { label: 'Registration', value: pdfText(identity.trailer.registration) },
          ]
        : [
            { label: 'Trailer number', value: pdfText(identity.trailer.number) },
            { label: 'Registration', value: pdfText(identity.trailer.registration) },
            { label: 'Trailer type', value: pdfText(identity.trailer.trailerType) },
          ],
    })
  }

  columns.push({ title: 'Inspection', fields: inspectionFields })
  y = renderInfoColumns(doc, y, columns)

  if (check.notes?.trim()) {
    y = ensureSpace(doc, y, 12, continuation)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.6)
    doc.setTextColor(...LABEL)
    doc.text('OVERALL NOTES', PDF_MARGIN, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.3)
    doc.setTextColor(...NAVY)
    const notes = doc.splitTextToSize(check.notes.trim(), PDF_CONTENT_WIDTH)
    doc.text(notes, PDF_MARGIN, y + 3.3)
    y += notes.length * 3.3 + 5
  }

  y = renderDefects(doc, y, report, continuation)

  for (const section of report.sections) {
    const numbered = report.numberedItems.filter((entry) => entry.section === section)
    const minKeepWithHeading = section.kind === 'trailer' ? 28 : 20
    y = ensureSpace(doc, y, minKeepWithHeading, continuation)
    y = renderChecklistSection(
      doc,
      y,
      section.title,
      section.subtitle,
      numbered.map((entry) => [
        String(entry.displayNumber),
        entry.item.itemName,
        formatVehicleCheckItemResultLabel(entry.item.result),
        pdfText(entry.item.comment),
      ]),
      continuation,
    )
  }

  const evidencePhotos = assets.photos.filter((photo) =>
    isUsableEvidenceImage(photo.dataUrl, assets.logoDataUrl),
  )
  y = ensureSpace(doc, y, evidencePhotos.length > 0 ? 36 : 14, continuation)
  y = renderSectionHeading(doc, 'Evidence / Photos', y)

  if (evidencePhotos.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text('No evidence photos attached', PDF_MARGIN, y)
    y += 8
  } else {
    const gap = 3.5
    const colWidth = (PDF_CONTENT_WIDTH - gap) / 2
    const maxImageHeight = 38

    for (let index = 0; index < evidencePhotos.length; index += 2) {
      const left = evidencePhotos[index]
      const right = evidencePhotos[index + 1]
      const leftSize = fitContain(left.naturalWidth, left.naturalHeight, colWidth, maxImageHeight)
      const rightSize = right
        ? fitContain(right.naturalWidth, right.naturalHeight, colWidth, maxImageHeight)
        : { width: 0, height: 0 }
      const rowImageH = Math.max(leftSize.height, rightSize.height)
      const rowH = rowImageH + 6.5
      y = ensureSpace(doc, y, rowH + 2, continuation)

      const place = (photo: VehicleCheckPdfPhotoAsset, x: number, photoIndex: number) => {
        doc.setDrawColor(...RULE)
        doc.setLineWidth(0.2)
        doc.rect(x, y, colWidth, rowImageH + 1.2)
        try {
          addContainedImage(
            doc,
            photo.dataUrl!,
            x,
            y,
            colWidth,
            rowImageH + 1.2,
            photo.naturalWidth,
            photo.naturalHeight,
            `evidence-photo-${photoIndex}`,
          )
        } catch {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7)
          doc.setTextColor(...MUTED)
          doc.text('Image unavailable', x + 2.4, y + 6)
        }
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(...LABEL)
        const caption = doc.splitTextToSize(photo.caption, colWidth - 2)
        doc.text(caption.slice(0, 2), x, y + rowImageH + 4)
      }

      place(left, PDF_MARGIN, index)
      if (right) place(right, PDF_MARGIN + colWidth + gap, index + 1)
      y += rowH + 1.6
    }
  }

  y = renderManagerReview(doc, y, check, reviewLabel, continuation)
  renderWorkerSignature(
    doc,
    y,
    check,
    identity,
    assets.signature,
    assets.logoDataUrl,
    continuation,
  )

  addReportFooters(doc, meta, reference)
  return doc
}

export async function measurePdfImageSize(
  dataUrl: string,
): Promise<{ width: number; height: number }> {
  if (typeof Image !== 'undefined') {
    return await new Promise((resolve) => {
      const image = new Image()
      image.onload = () => {
        resolve({
          width: image.naturalWidth || 4,
          height: image.naturalHeight || 3,
        })
      }
      image.onerror = () => resolve({ width: 4, height: 3 })
      image.src = dataUrl
    })
  }

  try {
    const comma = dataUrl.indexOf(',')
    const binary = atob(dataUrl.slice(comma + 1))
    if (binary.startsWith('\x89PNG')) {
      const view = new DataView(
        Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer,
      )
      return { width: view.getUint32(16), height: view.getUint32(20) }
    }
  } catch {
    // Fall through to a safe 4:3 placeholder.
  }
  return { width: 4, height: 3 }
}
