export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const mediaStandalone = window.matchMedia('(display-mode: standalone)').matches
  const mediaMinimal = window.matchMedia('(display-mode: minimal-ui)').matches
  const iosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

  return mediaStandalone || mediaMinimal || iosStandalone
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/i.test(ua)) {
    return true
  }

  // iPadOS desktop UA spoof
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

/** Safari on iOS/iPadOS — the browser that exposes Add to Home Screen reliably. */
export function isIosSafari(): boolean {
  if (!isIosDevice()) {
    return false
  }

  const ua = navigator.userAgent
  const isOtherBrowser =
    /CriOS|FxiOS|EdgiOS|OPiOS|OPT\//i.test(ua) ||
    (/Chrome/i.test(ua) && !/Safari/i.test(ua))

  return /Safari/i.test(ua) && !isOtherBrowser
}
