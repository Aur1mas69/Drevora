import { ExportUserError } from '@/lib/export/exportErrors'

async function waitForFonts(): Promise<void> {
  try {
    if (document.fonts?.ready) {
      await document.fonts.ready
    }
  } catch {
    // Font readiness is best-effort.
  }
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

export type CaptureHtmlElementOptions = {
  /** Minimum width used when the element has not laid out yet. */
  minWidth?: number
  scale?: number
}

/**
 * Capture a DOM node to canvas via html2canvas-pro (oklch / modern CSS colour support).
 * Throws if the resulting canvas is empty.
 */
export async function captureHtmlElementToCanvas(
  element: HTMLElement,
  options: CaptureHtmlElementOptions = {},
): Promise<HTMLCanvasElement> {
  await waitForFonts()
  await waitForPaint()

  const html2canvas = (await import('html2canvas-pro')).default
  const previousScrollTop = element.scrollTop
  element.scrollTop = 0

  // Force layout so scrollWidth/Height are valid before capture.
  void element.offsetWidth
  void element.offsetHeight

  const minWidth = options.minWidth ?? 1
  const width = Math.max(element.scrollWidth, element.clientWidth, minWidth)
  const height = Math.max(element.scrollHeight, element.clientHeight, 1)
  const scale = options.scale ?? 2

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: width,
      windowHeight: height,
      width,
      height,
    })

    if (!canvas.width || !canvas.height) {
      throw new ExportUserError('The export could not be generated. Please try again.')
    }

    return canvas
  } finally {
    element.scrollTop = previousScrollTop
  }
}

export function logTyreCheckPdfFailure(tyreCheckId: string, error: unknown): void {
  const reason =
    error instanceof Error
      ? error.message.slice(0, 240)
      : 'unknown_error'
  console.error('[tyre-check-pdf] export failed', {
    tyreCheckId,
    reason,
  })
}
