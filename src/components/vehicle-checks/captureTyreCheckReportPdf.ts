import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { TyreCheckAdminReport } from '@/components/vehicle-checks/TyreCheckAdminReport'
import { formatDateTimeFromIso } from '@/lib/dateTimeFormat'
import type { ExportMeta } from '@/lib/export/exportMeta'
import { ExportUserError } from '@/lib/export/exportErrors'
import {
  captureHtmlElementToCanvas,
  logTyreCheckPdfFailure,
} from '@/lib/export/html2canvasCapture'
import {
  addBrandedFooters,
  appendPdfImageBlock,
  createBrandedPdf,
  renderBrandedHeader,
} from '@/lib/export/pdfDocument'
import type { TyreCheckListItem, TyreMeasurement } from '@/lib/tyreCheckTypes'

export type TyreCheckPdfSource = {
  listItem: TyreCheckListItem
  measurements: TyreMeasurement[]
}

/** ~A4 content width at 96dpi — keeps diagrams sharp when scaled into 186mm. */
export const TYRE_CHECK_PDF_REPORT_WIDTH_PX = 794
/** html2canvas-pro scale for crisp text/diagrams without huge memory use. */
export const TYRE_CHECK_PDF_CAPTURE_SCALE = 3

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function continuationTitleFor(listItem: TyreCheckListItem): string {
  return `Tyre Check · ${listItem.vehicleRegistration}`
}

function queryPdfBlocks(reportNode: HTMLElement): HTMLElement[] {
  return Array.from(
    reportNode.querySelectorAll<HTMLElement>('[data-pdf-block]'),
  )
}

async function canvasToPngDataUrl(canvas: HTMLCanvasElement): Promise<string> {
  // Prefer toBlob for quality; fall back to toDataURL.
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/png')
  })
  if (blob && blob.size > 0) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result)
        else reject(new Error('png_read_failed'))
      }
      reader.onerror = () => reject(new Error('png_read_failed'))
      reader.readAsDataURL(blob)
    })
  }
  return canvas.toDataURL('image/png')
}

/**
 * Composes a visual Tyre Check PDF from `[data-pdf-block]` sections.
 * Blocks are captured sequentially and never mid-sliced across pages.
 */
export async function composeTyreCheckVisualPdfFromReport(
  reportNode: HTMLElement,
  listItem: TyreCheckListItem,
  meta: ExportMeta,
): Promise<Blob> {
  const blocks = queryPdfBlocks(reportNode)
  if (blocks.length === 0) {
    throw new ExportUserError('Unable to render tyre check report for PDF export.')
  }

  const reportWidth = Math.max(
    reportNode.clientWidth,
    reportNode.scrollWidth,
    TYRE_CHECK_PDF_REPORT_WIDTH_PX,
  )

  const doc = createBrandedPdf()
  let y = await renderBrandedHeader(doc, {
    ...meta,
    documentTitle: 'Tyre Check',
  })
  const contTitle = continuationTitleFor(listItem)
  let placed = 0

  for (const block of blocks) {
    void block.offsetWidth
    void block.offsetHeight
    if (block.scrollWidth < 4 || block.scrollHeight < 4) {
      continue
    }

    const blockWidth = Math.max(block.scrollWidth, block.clientWidth, 1)
    const canvas = await captureHtmlElementToCanvas(block, {
      minWidth: blockWidth,
      scale: TYRE_CHECK_PDF_CAPTURE_SCALE,
    })

    if (!canvas.width || !canvas.height) {
      throw new ExportUserError('The export could not be generated. Please try again.')
    }

    const png = await canvasToPngDataUrl(canvas)
    // Fit to report proportion so we do not stretch narrow captures.
    const cssWidth = canvas.width / TYRE_CHECK_PDF_CAPTURE_SCALE
    const widthRatio = Math.min(1, cssWidth / reportWidth)

    y = appendPdfImageBlock(doc, png, canvas.width, canvas.height, y, {
      continuationTitle: contTitle,
      isFirstContentOnDoc: placed === 0,
      widthRatio,
    })
    placed += 1
  }

  if (placed === 0) {
    throw new ExportUserError('Unable to render tyre check report for PDF export.')
  }

  addBrandedFooters(doc, meta)
  const blob = doc.output('blob')
  if (!blob || blob.size < 64) {
    throw new ExportUserError('The export could not be generated. Please try again.')
  }
  return blob
}

type MountedReport = {
  host: HTMLDivElement
  root: ReturnType<typeof createRoot>
  reportNode: HTMLElement
  cleanup: () => void
}

async function mountTyreCheckReportOffscreen(
  source: TyreCheckPdfSource,
): Promise<MountedReport> {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.setAttribute('data-tyre-check-pdf-host', source.listItem.id)
  host.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${TYRE_CHECK_PDF_REPORT_WIDTH_PX}px`,
    `max-width:${TYRE_CHECK_PDF_REPORT_WIDTH_PX}px`,
    'transform:translateX(-120vw)',
    'background:#ffffff',
    'color-scheme:light',
    'pointer-events:none',
    'z-index:0',
    'overflow:visible',
  ].join(';')

  document.body.appendChild(host)
  const root = createRoot(host)

  const trailerLabel =
    source.listItem.trailerRegistration || source.listItem.trailerNumber || null
  const vehicleMakeModel = [source.listItem.vehicleMake, source.listItem.vehicleModel]
    .filter(Boolean)
    .join(' ')
    .trim()
  const vehicleLabel = vehicleMakeModel
    ? `${source.listItem.vehicleRegistration} · ${vehicleMakeModel}`
    : source.listItem.vehicleRegistration

  const cleanup = () => {
    try {
      root.unmount()
    } catch {
      // Ignore unmount races.
    }
    host.remove()
  }

  try {
    root.render(
      createElement(TyreCheckAdminReport, {
        id: source.listItem.id,
        vehicleLabel,
        trailerLabel,
        checkedBy: source.listItem.workerName,
        completedLabel: formatDateTimeFromIso(source.listItem.inspectedAt),
        summaryLabel: source.listItem.summaryLabel,
        notes: source.listItem.notes,
        measurements: source.measurements,
        forPdfCapture: true,
      }),
    )

    await waitForPaint()
    await sleep(140)

    const reportNode = host.querySelector(
      `[data-tyre-check-report="${source.listItem.id}"]`,
    ) as HTMLElement | null

    if (!reportNode) {
      throw new ExportUserError('Unable to render tyre check report for PDF export.')
    }

    void reportNode.offsetWidth
    void reportNode.offsetHeight
    if (reportNode.scrollWidth < 8 || reportNode.scrollHeight < 8) {
      await sleep(80)
      void reportNode.offsetHeight
    }

    if (reportNode.scrollWidth < 8 || reportNode.scrollHeight < 8) {
      throw new ExportUserError('Unable to render tyre check report for PDF export.')
    }

    return { host, root, reportNode, cleanup }
  } catch (error) {
    cleanup()
    throw error
  }
}

/**
 * Mounts the Admin Tyre Check report off-screen and captures the full report canvas.
 * Prefer {@link composeTyreCheckVisualPdfBlob} for paginated exports.
 */
export async function captureTyreCheckReportCanvas(
  source: TyreCheckPdfSource,
): Promise<HTMLCanvasElement> {
  const mounted = await mountTyreCheckReportOffscreen(source)
  try {
    return await captureHtmlElementToCanvas(mounted.reportNode, {
      minWidth: TYRE_CHECK_PDF_REPORT_WIDTH_PX,
      scale: TYRE_CHECK_PDF_CAPTURE_SCALE,
    })
  } catch (error) {
    logTyreCheckPdfFailure(source.listItem.id, error)
    throw error
  } finally {
    mounted.cleanup()
  }
}

/**
 * Builds a high-quality visual Tyre Check PDF using safe DOM section boundaries.
 * Always tears down the temporary offscreen DOM (success or failure).
 */
export async function composeTyreCheckVisualPdfBlob(
  source: TyreCheckPdfSource,
  meta: ExportMeta,
  reportElement?: HTMLElement | null,
): Promise<Blob> {
  if (source.measurements.length > 0) {
    const mounted = await mountTyreCheckReportOffscreen(source)
    try {
      return await composeTyreCheckVisualPdfFromReport(
        mounted.reportNode,
        source.listItem,
        meta,
      )
    } catch (error) {
      logTyreCheckPdfFailure(source.listItem.id, error)
      throw error
    } finally {
      mounted.cleanup()
    }
  }

  if (!reportElement) {
    const error = new ExportUserError('Unable to render tyre check report for PDF export.')
    logTyreCheckPdfFailure(source.listItem.id, error)
    throw error
  }

  try {
    return await composeTyreCheckVisualPdfFromReport(
      reportElement,
      source.listItem,
      meta,
    )
  } catch (error) {
    logTyreCheckPdfFailure(source.listItem.id, error)
    throw error
  }
}
