import { Download, Share, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  isIosSafari,
  isStandaloneDisplayMode,
  type BeforeInstallPromptEvent,
} from '@/components/pwa/pwaUtils'

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [showIosCard, setShowIosCard] = useState(false)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [installed, setInstalled] = useState(() => isStandaloneDisplayMode())

  useEffect(() => {
    if (installed || dismissed) {
      return
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setShowIosCard(false)
    }

    function handleAppInstalled() {
      setInstalled(true)
      setDeferredPrompt(null)
      setShowIosCard(false)
      setShowIosHelp(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    if (!isStandaloneDisplayMode() && isIosSafari()) {
      setShowIosCard(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [dismissed, installed])

  const handleInstallClick = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      setDeferredPrompt(null)
      if (choice.outcome === 'accepted') {
        setInstalled(true)
      }
      return
    }

    if (showIosCard) {
      setShowIosHelp(true)
    }
  }, [deferredPrompt, showIosCard])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    setDeferredPrompt(null)
    setShowIosCard(false)
    setShowIosHelp(false)
  }, [])

  if (installed || dismissed) {
    return null
  }

  const canShowAndroidOrDesktop = Boolean(deferredPrompt)
  const canShowIos = showIosCard && !deferredPrompt

  if (!canShowAndroidOrDesktop && !canShowIos) {
    return null
  }

  return (
    <>
      <div className="fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] z-[84] mx-auto max-w-md motion-reduce:transition-none sm:inset-x-auto sm:right-4 sm:bottom-6 sm:mx-0">
        <div className="rounded-2xl border border-[#C5DFFB]/90 bg-[#FAFCFF]/98 p-3.5 shadow-[0_16px_40px_rgba(33,142,231,0.16)] ring-1 ring-[#D3E9FC]/80 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/95 dark:shadow-black/40 dark:ring-white/10">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#EAF4FF] text-[#2563EB] dark:bg-blue-500/15 dark:text-blue-300">
              <Download className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Install DREVORA
              </p>
              <p className="mt-0.5 text-xs leading-snug text-slate-600 dark:text-slate-300">
                {canShowIos
                  ? 'Add DREVORA to your Home Screen for faster access.'
                  : 'Install the app for a full-screen DREVORA experience.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleInstallClick()}
                  aria-label="Install DREVORA app"
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#2563EB] px-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFCFF] dark:focus-visible:ring-offset-slate-900"
                >
                  Install app
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  aria-label="Dismiss install prompt"
                  className="inline-flex size-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFCFF] dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-offset-slate-900"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showIosHelp ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 backdrop-blur-sm sm:items-center sm:pb-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-ios-install-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#C5DFFB]/90 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <h2
                id="pwa-ios-install-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-50"
              >
                Add DREVORA to Home Screen
              </h2>
              <button
                type="button"
                onClick={() => setShowIosHelp(false)}
                aria-label="Close installation instructions"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/35 dark:hover:bg-white/10"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <ol className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              <li className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#EAF4FF] text-xs font-bold text-[#2563EB] dark:bg-blue-500/15 dark:text-blue-300">
                  1
                </span>
                <span>
                  Tap the{' '}
                  <Share
                    className="mx-0.5 inline size-4 align-text-bottom text-[#2563EB]"
                    aria-hidden="true"
                  />{' '}
                  <strong>Share</strong> button in Safari.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#EAF4FF] text-xs font-bold text-[#2563EB] dark:bg-blue-500/15 dark:text-blue-300">
                  2
                </span>
                <span>
                  Choose <strong>Add to Home Screen</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#EAF4FF] text-xs font-bold text-[#2563EB] dark:bg-blue-500/15 dark:text-blue-300">
                  3
                </span>
                <span>
                  Confirm <strong>Add</strong> to finish.
                </span>
              </li>
            </ol>
            <p className="mt-4 text-xs leading-snug text-slate-500 dark:text-slate-400">
              iPhone and iPad use Safari’s Share menu. There is no Android-style install
              prompt on iOS.
            </p>
            <button
              type="button"
              onClick={() => setShowIosHelp(false)}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/40"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
