import type { ExportMeta } from '@/lib/export/exportMeta'
import { jsPDF } from 'jspdf'
import autoTable, { type UserOptions } from 'jspdf-autotable'

export const PDF_MARGIN = 12
export const PDF_CONTENT_WIDTH = 210 - PDF_MARGIN * 2
export const PDF_FOOTER_Y = 287

const HEADER_NAVY: [number, number, number] = [11, 38, 70]
const DREVORA_BLUE: [number, number, number] = [33, 142, 231]
const NAVY: [number, number, number] = [17, 60, 105]
const LABEL: [number, number, number] = [61, 122, 156]
const BORDER: [number, number, number] = [211, 233, 252]
const SOFT_BLUE: [number, number, number] = [245, 250, 255]
const WHITE: [number, number, number] = [255, 255, 255]

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } }

export function createBrandedPdf(): jsPDF {
  return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
}

async function tryLoadImageDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) return null
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function renderBrandedHeader(
  doc: jsPDF,
  meta: ExportMeta,
  options?: { subtitle?: string | null },
): Promise<number> {
  const headerHeight = 34
  doc.setFillColor(...HEADER_NAVY)
  doc.rect(0, 0, 210, headerHeight, 'F')
  doc.setFillColor(...DREVORA_BLUE)
  doc.rect(0, headerHeight, 210, 1.2, 'F')

  let textX = PDF_MARGIN
  if (meta.logoUrl) {
    const dataUrl = await tryLoadImageDataUrl(meta.logoUrl)
    if (dataUrl) {
      try {
        doc.addImage(dataUrl, 'PNG', PDF_MARGIN, 6, 14, 14)
        textX = PDF_MARGIN + 18
      } catch {
        // Logo optional — continue with text branding.
      }
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...WHITE)
  doc.text('DREVORA', textX, 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(190, 220, 245)
  doc.text(meta.companyName, textX, 19)

  const rightX = 210 - PDF_MARGIN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...WHITE)
  doc.text(meta.documentTitle, rightX, 12, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(190, 220, 245)
  doc.text(meta.generatedAtLabel, rightX, 18, { align: 'right' })

  if (options?.subtitle) {
    doc.text(options.subtitle, rightX, 23.5, { align: 'right' })
  }

  return headerHeight + 8
}

export function renderKeyValueSection(
  doc: jsPDF,
  startY: number,
  fields: Array<{ label: string; value: string }>,
  columns = 2,
): number {
  const rowHeight = 11
  const colWidth = PDF_CONTENT_WIDTH / columns
  const rows = Math.ceil(fields.length / columns)
  const height = rows * rowHeight + 6

  doc.setFillColor(...SOFT_BLUE)
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.roundedRect(PDF_MARGIN, startY, PDF_CONTENT_WIDTH, height, 2, 2, 'FD')

  fields.forEach((field, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    const x = PDF_MARGIN + col * colWidth + 3
    const y = startY + 5 + row * rowHeight

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...LABEL)
    doc.text(field.label.toUpperCase(), x, y)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...NAVY)
    const lines = doc.splitTextToSize(field.value || '—', colWidth - 8)
    doc.text(lines.slice(0, 2), x, y + 4.2)
  })

  return startY + height + 4
}

export function renderSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text(title, PDF_MARGIN, y)
  return y + 4
}

export function renderPdfTable(
  doc: jsPDF,
  startY: number,
  head: string[],
  body: string[][],
  options?: Partial<UserOptions>,
): number {
  autoTable(doc, {
    startY,
    head: [head],
    body,
    margin: { left: PDF_MARGIN, right: PDF_MARGIN, bottom: 18 },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 1.6,
      textColor: NAVY,
      lineColor: BORDER,
      lineWidth: 0.2,
      overflow: 'linebreak',
      valign: 'top',
    },
    headStyles: {
      fillColor: DREVORA_BLUE,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: SOFT_BLUE },
    ...options,
  })

  const finalY = (doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? startY
  return finalY + 4
}

export function addBrandedFooters(doc: jsPDF, meta: ExportMeta): void {
  const pageCount = doc.getNumberOfPages()

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.2)
    doc.line(PDF_MARGIN, PDF_FOOTER_Y - 5, PDF_MARGIN + PDF_CONTENT_WIDTH, PDF_FOOTER_Y - 5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...LABEL)

    const left = meta.generatedBy
      ? `Generated by DREVORA · ${meta.generatedBy}`
      : 'Generated by DREVORA'
    doc.text(left, PDF_MARGIN, PDF_FOOTER_Y)
    doc.text(meta.companyName, PDF_MARGIN + PDF_CONTENT_WIDTH / 2, PDF_FOOTER_Y, {
      align: 'center',
    })
    doc.text(`Page ${page} of ${pageCount}`, PDF_MARGIN + PDF_CONTENT_WIDTH, PDF_FOOTER_Y, {
      align: 'right',
    })
  }
}

export async function fetchImageDataUrlForPdf(url: string): Promise<string | null> {
  return tryLoadImageDataUrl(url)
}

/**
 * Places a canvas image into the PDF starting at `startY`, slicing across pages
 * when taller than the remaining printable area (above the branded footer).
 * Prefer block-based placement for visual reports that must not cut mid-section.
 */
export function appendCanvasImageAcrossPages(
  doc: jsPDF,
  canvas: HTMLCanvasElement,
  startY: number,
  options?: { margin?: number; footerReserveMm?: number },
): void {
  const margin = options?.margin ?? PDF_MARGIN
  const footerReserve = options?.footerReserveMm ?? 18
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - margin * 2
  const fullImageHeightMm = (canvas.height * contentWidth) / canvas.width
  const pxPerMm = canvas.height / fullImageHeightMm

  let remainingHeightMm = fullImageHeightMm
  let sourceYPx = 0
  let y = startY

  while (remainingHeightMm > 0.4) {
    const availableMm = pageHeight - footerReserve - y
    if (availableMm < 12) {
      doc.addPage()
      y = margin
      continue
    }

    const sliceHeightMm = Math.min(remainingHeightMm, availableMm)
    const sliceHeightPx = Math.max(1, Math.round(sliceHeightMm * pxPerMm))

    const sliceCanvas = document.createElement('canvas')
    sliceCanvas.width = canvas.width
    sliceCanvas.height = sliceHeightPx
    const context = sliceCanvas.getContext('2d')
    if (!context) break

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
    context.drawImage(
      canvas,
      0,
      sourceYPx,
      canvas.width,
      sliceHeightPx,
      0,
      0,
      canvas.width,
      sliceHeightPx,
    )

    doc.addImage(
      sliceCanvas.toDataURL('image/png'),
      'PNG',
      margin,
      y,
      contentWidth,
      sliceHeightMm,
    )

    remainingHeightMm -= sliceHeightMm
    sourceYPx += sliceHeightPx

    if (remainingHeightMm > 0.4) {
      doc.addPage()
      y = margin
    }
  }
}

/** Bottom Y of the printable content area (above branded footer). */
export function pdfContentBottomY(
  doc: jsPDF,
  footerReserveMm = 18,
): number {
  return doc.internal.pageSize.getHeight() - footerReserveMm
}

/** Small title line for continuation pages of a multi-page visual report. */
export function renderPdfContinuationHeader(
  doc: jsPDF,
  title: string,
  startY = PDF_MARGIN,
): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text(title, PDF_MARGIN, startY + 3)

  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.25)
  doc.line(
    PDF_MARGIN,
    startY + 5.5,
    PDF_MARGIN + PDF_CONTENT_WIDTH,
    startY + 5.5,
  )

  return startY + 9
}

/**
 * Places one complete PNG image block without slicing.
 * Starts a new page when the block does not fit the remaining space.
 * Oversized blocks (taller than a full page) are scaled down to fit.
 */
export function appendPdfImageBlock(
  doc: jsPDF,
  imageDataUrl: string,
  naturalWidthPx: number,
  naturalHeightPx: number,
  startY: number,
  options?: {
    margin?: number
    footerReserveMm?: number
    gapMm?: number
    continuationTitle?: string | null
    isFirstContentOnDoc?: boolean
    /** 0–1 share of content width (default 1). */
    widthRatio?: number
  },
): number {
  const margin = options?.margin ?? PDF_MARGIN
  const footerReserve = options?.footerReserveMm ?? 18
  const gapMm = options?.gapMm ?? 2.5
  const widthRatio = Math.min(1, Math.max(0.15, options?.widthRatio ?? 1))
  const contentWidth = PDF_CONTENT_WIDTH * widthRatio
  const pageBottom = pdfContentBottomY(doc, footerReserve)

  let y = startY
  let heightMm = (naturalHeightPx * contentWidth) / Math.max(naturalWidthPx, 1)
  let widthMm = contentWidth

  const available = pageBottom - y
  if (heightMm > available + 0.2) {
    const minUseful = options?.isFirstContentOnDoc ? 8 : 14
    if (y > margin + minUseful) {
      doc.addPage()
      y = options?.continuationTitle
        ? renderPdfContinuationHeader(doc, options.continuationTitle, margin)
        : margin
    }

    const fullPageAvailable = pageBottom - y
    if (heightMm > fullPageAvailable) {
      const scale = fullPageAvailable / heightMm
      widthMm = contentWidth * scale
      heightMm = fullPageAvailable
    }
  }

  doc.addImage(imageDataUrl, 'PNG', margin, y, widthMm, heightMm)
  return y + heightMm + gapMm
}

export function pdfText(value: string | number | null | undefined): string {
  if (value == null) return '—'
  const text = String(value).trim()
  return text || '—'
}
