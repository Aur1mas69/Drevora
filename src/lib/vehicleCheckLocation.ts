/**
 * One-shot device GPS capture for Vehicle Checks.
 *
 * Used exactly twice per inspection: once when the Worker starts a Vehicle
 * Check, and once immediately before the completed Vehicle Check is saved.
 * This is NOT live tracking — no watch/poll, no background requests, no
 * repeated prompts. Location is supporting information only and must never
 * block the Vehicle Check workflow; every failure path resolves (never
 * rejects) so callers can safely continue without location.
 */

export type VehicleCheckLocationCapture = {
  latitude: number
  longitude: number
  /** Device-reported accuracy in metres, when available. */
  accuracy: number | null
  /** ISO timestamp the device actually returned the GPS fix (not the workflow action time). */
  capturedAt: string
}

export type VehicleCheckLocationFailureReason =
  | 'unavailable'
  | 'permission_denied'
  | 'timeout'
  | 'unsupported'
  | 'unknown'

export type VehicleCheckLocationResult =
  | { status: 'success'; location: VehicleCheckLocationCapture }
  | { status: 'failure'; reason: VehicleCheckLocationFailureReason }

const DEFAULT_TIMEOUT_MS = 9000

function isGeolocationSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.geolocation !== 'undefined' &&
    typeof navigator.geolocation.getCurrentPosition === 'function'
  )
}

function mapPositionErrorCode(code: number): VehicleCheckLocationFailureReason {
  switch (code) {
    case 1: // PERMISSION_DENIED (also covers a dismissed mobile permission prompt)
      return 'permission_denied'
    case 3: // TIMEOUT
      return 'timeout'
    case 2: // POSITION_UNAVAILABLE (e.g. location services disabled, weak/no signal)
      return 'unavailable'
    default:
      return 'unknown'
  }
}

/**
 * Requests the current device position once. Always resolves — never throws
 * — so it is safe to call without wrapping in try/catch at the call site.
 */
export function captureVehicleCheckLocation(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<VehicleCheckLocationResult> {
  if (!isGeolocationSupported()) {
    return Promise.resolve({ status: 'failure', reason: 'unsupported' })
  }

  return new Promise((resolve) => {
    let settled = false
    const settle = (result: VehicleCheckLocationResult) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          settle({
            status: 'success',
            location: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy:
                typeof position.coords.accuracy === 'number' &&
                Number.isFinite(position.coords.accuracy)
                  ? position.coords.accuracy
                  : null,
              capturedAt: new Date(position.timestamp).toISOString(),
            },
          })
        },
        (positionError) => {
          settle({ status: 'failure', reason: mapPositionErrorCode(positionError.code) })
        },
        {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 0,
        },
      )
    } catch {
      // Defensive: some mobile/webview shells throw synchronously instead of
      // invoking the error callback (e.g. permission dialog dismissed oddly).
      settle({ status: 'failure', reason: 'unknown' })
    }
  })
}

/** DB-ready shape for the four columns tied to one captured moment (start or completion). */
export type VehicleCheckLocationColumns = {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  locationAt: string | null
}

export const EMPTY_VEHICLE_CHECK_LOCATION_COLUMNS: VehicleCheckLocationColumns = {
  latitude: null,
  longitude: null,
  accuracy: null,
  locationAt: null,
}

/** Never fabricates 0,0 or any default coordinate — failures map to all-NULL columns. */
export function toVehicleCheckLocationColumns(
  result: VehicleCheckLocationResult | null | undefined,
): VehicleCheckLocationColumns {
  if (!result || result.status !== 'success') {
    return EMPTY_VEHICLE_CHECK_LOCATION_COLUMNS
  }

  return {
    latitude: result.location.latitude,
    longitude: result.location.longitude,
    accuracy: result.location.accuracy,
    locationAt: result.location.capturedAt,
  }
}

// ---------------------------------------------------------------------------
// Admin display formatting — coordinates are only rounded for presentation;
// stored values are never rounded in the database.
// ---------------------------------------------------------------------------

const COORDINATE_DISPLAY_DECIMALS = 6

export function formatVehicleCheckCoordinate(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toFixed(COORDINATE_DISPLAY_DECIMALS)
}

export function formatVehicleCheckAccuracy(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'Accuracy unavailable'
  return `${Math.round(value).toLocaleString()} metres`
}

/** "52.414820, 0.746310" — used only for the optional copy-coordinates action. */
export function formatVehicleCheckCoordinatePair(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): string | null {
  if (latitude == null || longitude == null) return null
  return `${latitude.toFixed(COORDINATE_DISPLAY_DECIMALS)}, ${longitude.toFixed(COORDINATE_DISPLAY_DECIMALS)}`
}
