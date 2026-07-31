import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { addNativeBackButtonListener } from '@/lib/nativeBackButton'

const GUARD_STATE_KEY = '__drevoraWorkerExitGuard'

export type WorkerNavigationBlocker = {
  /** True while an in-progress flow must confirm before leave. */
  isActive: boolean
  /** True while the exit confirmation modal is visible. */
  isConfirmOpen: boolean
  /** Close the confirm modal without leaving (system Back while modal open). */
  onCancelConfirm: () => void
  /**
   * Show confirmation; call `proceed` only after the Worker confirms exit.
   * `proceed` may navigate, reset local step, or go back in history.
   */
  onLeaveAttempt: (proceed: () => void) => void
  /**
   * Default exit when browser / Android Back is confirmed.
   * Typically navigate to the parent Worker route.
   */
  onHistoryBackExit: () => void
}

type WorkerNavigationGuardContextValue = {
  /** Register or clear the active page blocker (one at a time). */
  setBlocker: (blocker: WorkerNavigationBlocker | null) => void
  /**
   * Attempt to leave the current screen. If a blocker is active, shows confirm
   * and runs `proceed` only after Exit. If the confirm modal is already open,
   * closes the modal instead (does not leave).
   */
  attemptLeave: (proceed: () => void) => void
}

const WorkerNavigationGuardContext =
  createContext<WorkerNavigationGuardContextValue | null>(null)

function isGuardHistoryState(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    (state as { [GUARD_STATE_KEY]?: boolean })[GUARD_STATE_KEY] === true
  )
}

export function WorkerNavigationGuardProvider({
  children,
}: {
  children: ReactNode
}) {
  const blockerRef = useRef<WorkerNavigationBlocker | null>(null)
  const bypassRef = useRef(false)
  const guardPushedRef = useRef(false)

  const pushGuardState = useCallback(() => {
    if (guardPushedRef.current) return
    window.history.pushState({ [GUARD_STATE_KEY]: true }, '')
    guardPushedRef.current = true
  }, [])

  const dropGuardStateIfPresent = useCallback(() => {
    if (!guardPushedRef.current) return
    guardPushedRef.current = false
    if (!isGuardHistoryState(window.history.state)) return
    bypassRef.current = true
    window.history.back()
    queueMicrotask(() => {
      bypassRef.current = false
    })
  }, [])

  const setBlocker = useCallback(
    (blocker: WorkerNavigationBlocker | null) => {
      const nextActive = Boolean(blocker?.isActive)
      blockerRef.current = blocker

      if (nextActive) {
        pushGuardState()
      } else {
        dropGuardStateIfPresent()
      }
    },
    [dropGuardStateIfPresent, pushGuardState],
  )

  const attemptLeave = useCallback((proceed: () => void) => {
    const blocker = blockerRef.current

    if (bypassRef.current || !blocker?.isActive) {
      proceed()
      return
    }

    // System / browser Back while the modal is open → dismiss modal only.
    if (blocker.isConfirmOpen) {
      blocker.onCancelConfirm()
      return
    }

    blocker.onLeaveAttempt(() => {
      bypassRef.current = true
      try {
        proceed()
      } finally {
        queueMicrotask(() => {
          bypassRef.current = false
        })
      }
    })
  }, [])

  useEffect(() => {
    function onPopState() {
      if (bypassRef.current) {
        guardPushedRef.current = isGuardHistoryState(window.history.state)
        return
      }

      const blocker = blockerRef.current
      if (!blocker?.isActive) {
        guardPushedRef.current = false
        return
      }

      // Stay on the current URL; re-arm sentinel.
      window.history.pushState({ [GUARD_STATE_KEY]: true }, '')
      guardPushedRef.current = true

      if (blocker.isConfirmOpen) {
        blocker.onCancelConfirm()
        return
      }

      attemptLeave(() => {
        blocker.onHistoryBackExit()
      })
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [attemptLeave])

  // Capacitor hardware Back (native only; web stub is a no-op).
  useEffect(() => {
    let handle: { remove: () => Promise<void> } | null = null
    let cancelled = false

    void addNativeBackButtonListener(() => {
      const blocker = blockerRef.current
      if (blocker?.isConfirmOpen) {
        blocker.onCancelConfirm()
        return
      }
      if (blocker?.isActive) {
        // Prefer the shared popstate path: go back one history entry so the
        // sentinel handler opens the same modal as browser Back.
        window.history.back()
        return
      }
      window.history.back()
    }).then((listener) => {
      if (cancelled) {
        void listener.remove()
        return
      }
      handle = listener
    })

    return () => {
      cancelled = true
      void handle?.remove()
    }
  }, [])

  const value = useMemo(
    () => ({ setBlocker, attemptLeave }),
    [setBlocker, attemptLeave],
  )

  return (
    <WorkerNavigationGuardContext.Provider value={value}>
      {children}
    </WorkerNavigationGuardContext.Provider>
  )
}

export function useWorkerNavigationGuard(): WorkerNavigationGuardContextValue {
  const ctx = useContext(WorkerNavigationGuardContext)
  if (!ctx) {
    throw new Error(
      'useWorkerNavigationGuard must be used within WorkerNavigationGuardProvider',
    )
  }
  return ctx
}
