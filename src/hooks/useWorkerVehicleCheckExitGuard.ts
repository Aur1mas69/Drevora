import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useWorkerNavigationGuard,
  type WorkerNavigationBlocker,
} from '@/contexts/WorkerNavigationGuardContext'
import { setWorkerActiveCheckSession } from '@/lib/workerActiveCheckSession'

type UseWorkerVehicleCheckExitGuardOptions = {
  /** True only after the check has started and before successful completion. */
  isCheckActive: boolean
  /** Discard in-progress checklist and return to setup (page Back). */
  onDiscardToSetup: () => void
}

/**
 * Shared exit-confirmation wiring for an active Worker check (Vehicle / Tyre).
 * Registers with WorkerNavigationGuardProvider; owns the confirm modal state.
 * Back while the modal is open dismisses the modal only (no leave / no loop).
 */
export function useWorkerVehicleCheckExitGuard({
  isCheckActive,
  onDiscardToSetup,
}: UseWorkerVehicleCheckExitGuardOptions) {
  const { setBlocker, attemptLeave } = useWorkerNavigationGuard()
  const navigate = useNavigate()
  const [exitOpen, setExitOpen] = useState(false)
  const pendingProceedRef = useRef<(() => void) | null>(null)
  const exitOpenRef = useRef(false)
  const onDiscardToSetupRef = useRef(onDiscardToSetup)
  onDiscardToSetupRef.current = onDiscardToSetup

  useEffect(() => {
    setWorkerActiveCheckSession(isCheckActive)
    return () => {
      setWorkerActiveCheckSession(false)
    }
  }, [isCheckActive])

  const closeExitModal = useCallback(() => {
    pendingProceedRef.current = null
    exitOpenRef.current = false
    setExitOpen(false)
  }, [])

  const handleContinueCheck = useCallback(() => {
    closeExitModal()
  }, [closeExitModal])

  const handleExitCheck = useCallback(() => {
    const proceed = pendingProceedRef.current
    pendingProceedRef.current = null
    exitOpenRef.current = false
    setExitOpen(false)
    proceed?.()
  }, [])

  useEffect(() => {
    if (!isCheckActive) {
      pendingProceedRef.current = null
      exitOpenRef.current = false
      setExitOpen(false)
      setBlocker(null)
      return
    }

    const blocker: WorkerNavigationBlocker = {
      isActive: true,
      get isConfirmOpen() {
        return exitOpenRef.current
      },
      onCancelConfirm: () => {
        pendingProceedRef.current = null
        exitOpenRef.current = false
        setExitOpen(false)
      },
      onLeaveAttempt: (proceed) => {
        if (exitOpenRef.current) {
          pendingProceedRef.current = proceed
          return
        }
        pendingProceedRef.current = proceed
        exitOpenRef.current = true
        setExitOpen(true)
      },
      onHistoryBackExit: () => {
        navigate('/worker/vehicles', { replace: true })
      },
    }

    setBlocker(blocker)
    return () => setBlocker(null)
  }, [isCheckActive, navigate, setBlocker])

  const requestExitToSetup = useCallback(() => {
    attemptLeave(() => {
      onDiscardToSetupRef.current()
    })
  }, [attemptLeave])

  const requestExitToVehicles = useCallback(() => {
    attemptLeave(() => {
      navigate('/worker/vehicles', { replace: true })
    })
  }, [attemptLeave, navigate])

  return {
    exitOpen,
    handleContinueCheck,
    handleExitCheck,
    requestExitToSetup,
    requestExitToVehicles,
    attemptLeave,
  }
}
