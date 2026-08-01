/**
 * Worker Web/PWA visual-viewport sync for iOS installed PWA cold launch.
 *
 * iOS can report a stale layout viewport on the first standalone paint; a manual
 * refresh remeasures correctly. One CSS custom property is the source of truth
 * for Worker shell min-height — updated from visualViewport when available.
 */

export const WORKER_VVH_CSS_VAR = '--drevora-worker-vvh'
export const WORKER_VVW_CSS_VAR = '--drevora-worker-vvw'
export const WORKER_VVH_HTML_CLASS = 'worker-vvh-ready'

/** Ignore large shrinks (software keyboard) so the shell does not collapse. */
const KEYBOARD_SHRINK_PX = 140

let stableHeightPx = 0

function readMeasuredSize(): { height: number; width: number } {
  const vv = window.visualViewport
  return {
    height: Math.round(vv?.height ?? window.innerHeight),
    width: Math.round(vv?.width ?? window.innerWidth),
  }
}

/**
 * Writes viewport CSS vars on <html>. Returns true when either value changed.
 */
export function syncWorkerVisualViewportCssVars(options?: {
  force?: boolean
}): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false
  }

  const { height: measuredHeight, width: measuredWidth } = readMeasuredSize()
  let nextHeight = measuredHeight

  if (
    !options?.force &&
    stableHeightPx > 0 &&
    measuredHeight < stableHeightPx - KEYBOARD_SHRINK_PX
  ) {
    nextHeight = stableHeightPx
  } else {
    stableHeightPx = measuredHeight
    nextHeight = measuredHeight
  }

  const root = document.documentElement
  const nextH = `${nextHeight}px`
  const nextW = `${measuredWidth}px`
  const prevH = root.style.getPropertyValue(WORKER_VVH_CSS_VAR)
  const prevW = root.style.getPropertyValue(WORKER_VVW_CSS_VAR)
  let changed = false

  if (prevH !== nextH) {
    root.style.setProperty(WORKER_VVH_CSS_VAR, nextH)
    changed = true
  }
  if (prevW !== nextW) {
    root.style.setProperty(WORKER_VVW_CSS_VAR, nextW)
    changed = true
  }

  root.classList.add(WORKER_VVH_HTML_CLASS)
  return changed
}

export function clearWorkerVisualViewportCssVars(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.removeProperty(WORKER_VVH_CSS_VAR)
  root.style.removeProperty(WORKER_VVW_CSS_VAR)
  root.classList.remove(WORKER_VVH_HTML_CLASS)
  stableHeightPx = 0
}

/**
 * Keep Worker shell CSS vars aligned with the settled iOS/Android viewport.
 * Call from MainLayout only (after legal/auth gates mount the Worker chrome).
 */
export function subscribeWorkerVisualViewportSync(): () => void {
  const sync = (force = false) => {
    syncWorkerVisualViewportCssVars({ force })
  }

  sync(true)

  let rafOuter = 0
  let rafInner = 0
  rafOuter = window.requestAnimationFrame(() => {
    sync(true)
    rafInner = window.requestAnimationFrame(() => sync(true))
  })

  // Bounded cold-start rechecks — iOS often settles after the first paint.
  const timeoutIds = [50, 250, 600].map((ms) =>
    window.setTimeout(() => sync(true), ms),
  )

  const onResize = () => sync(false)
  const onForced = () => sync(true)

  const onPageShow = (event: PageTransitionEvent) => {
    // Always remeasure after bfcache / PWA resume.
    void event
    sync(true)
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') sync(true)
  }

  window.addEventListener('resize', onResize)
  window.addEventListener('orientationchange', onForced)
  window.addEventListener('pageshow', onPageShow)
  document.addEventListener('visibilitychange', onVisibility)

  const vv = window.visualViewport
  vv?.addEventListener('resize', onResize)

  return () => {
    window.cancelAnimationFrame(rafOuter)
    window.cancelAnimationFrame(rafInner)
    for (const id of timeoutIds) window.clearTimeout(id)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('orientationchange', onForced)
    window.removeEventListener('pageshow', onPageShow)
    document.removeEventListener('visibilitychange', onVisibility)
    vv?.removeEventListener('resize', onResize)
    clearWorkerVisualViewportCssVars()
  }
}
