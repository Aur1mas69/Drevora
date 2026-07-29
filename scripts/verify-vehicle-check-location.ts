/**
 * Verifies the Vehicle Check GPS capture helper (start/completion location):
 * success/permission_denied/timeout/unsupported outcomes, that failures never
 * fabricate 0,0 coordinates, and the Admin display formatting helpers.
 * Run: npx tsx scripts/verify-vehicle-check-location.ts
 */
import {
  captureVehicleCheckLocation,
  formatVehicleCheckAccuracy,
  formatVehicleCheckCoordinate,
  formatVehicleCheckCoordinatePair,
  toVehicleCheckLocationColumns,
  type VehicleCheckLocationResult,
} from '../src/lib/vehicleCheckLocation.ts'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

type MockGeolocation = {
  getCurrentPosition: (
    onSuccess: (position: GeolocationPosition) => void,
    onError: (error: GeolocationPositionError) => void,
  ) => void
}

function setGlobalNavigator(value: unknown) {
  Object.defineProperty(globalThis, 'navigator', {
    value,
    configurable: true,
    writable: true,
  })
}

function withMockGeolocation<T>(geolocation: MockGeolocation | undefined, run: () => Promise<T>) {
  const original = (globalThis as { navigator?: unknown }).navigator
  setGlobalNavigator(geolocation ? { geolocation } : { geolocation: undefined })
  return run().finally(() => {
    setGlobalNavigator(original)
  })
}

function mockPosition(latitude: number, longitude: number, accuracy: number | null): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy: accuracy ?? (undefined as unknown as number),
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.parse('2026-07-29T06:31:00.000Z'),
    toJSON: () => ({}),
  } as unknown as GeolocationPosition
}

function mockError(code: number): GeolocationPositionError {
  return {
    code,
    message: 'mock error',
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as unknown as GeolocationPositionError
}

async function run() {
  // 1) Unsupported browser (no geolocation)
  const unsupported = await withMockGeolocation(undefined, () => captureVehicleCheckLocation())
  assert(unsupported.status === 'failure', 'unsupported → failure')
  assert(
    unsupported.status === 'failure' && unsupported.reason === 'unsupported',
    'unsupported → reason unsupported',
  )

  // 2) Success result
  const success = await withMockGeolocation(
    {
      getCurrentPosition: (onSuccess) => onSuccess(mockPosition(52.41482, 0.74631, 18)),
    },
    () => captureVehicleCheckLocation(),
  )
  assert(success.status === 'success', 'success result status')
  if (success.status === 'success') {
    assert(success.location.latitude === 52.41482, 'success latitude passthrough')
    assert(success.location.longitude === 0.74631, 'success longitude passthrough')
    assert(success.location.accuracy === 18, 'success accuracy passthrough')
    assert(success.location.capturedAt === '2026-07-29T06:31:00.000Z', 'success capturedAt from device timestamp')
  }

  // 3) Permission denied
  const denied = await withMockGeolocation(
    { getCurrentPosition: (_onSuccess, onError) => onError(mockError(1)) },
    () => captureVehicleCheckLocation(),
  )
  assert(denied.status === 'failure' && denied.reason === 'permission_denied', 'code 1 → permission_denied')

  // 4) Position unavailable (weak signal / location services disabled)
  const unavailable = await withMockGeolocation(
    { getCurrentPosition: (_onSuccess, onError) => onError(mockError(2)) },
    () => captureVehicleCheckLocation(),
  )
  assert(unavailable.status === 'failure' && unavailable.reason === 'unavailable', 'code 2 → unavailable')

  // 5) Timeout
  const timeout = await withMockGeolocation(
    { getCurrentPosition: (_onSuccess, onError) => onError(mockError(3)) },
    () => captureVehicleCheckLocation(),
  )
  assert(timeout.status === 'failure' && timeout.reason === 'timeout', 'code 3 → timeout')

  // 6) Unexpected synchronous throw is caught, never propagated to the UI
  const unknown = await withMockGeolocation(
    {
      getCurrentPosition: () => {
        throw new Error('unexpected native bridge error')
      },
    },
    () => captureVehicleCheckLocation(),
  )
  assert(unknown.status === 'failure' && unknown.reason === 'unknown', 'synchronous throw → unknown failure, not a crash')

  // 7) Failures never fabricate 0,0 — mapping to DB columns is always all-NULL
  const failureResults: VehicleCheckLocationResult[] = [unsupported, denied, unavailable, timeout, unknown]
  for (const failure of failureResults) {
    const columns = toVehicleCheckLocationColumns(failure)
    assert(columns.latitude === null, 'failure never fabricates latitude 0')
    assert(columns.longitude === null, 'failure never fabricates longitude 0')
    assert(columns.accuracy === null, 'failure never fabricates accuracy')
    assert(columns.locationAt === null, 'failure never fabricates locationAt')
  }
  assert(toVehicleCheckLocationColumns(null).latitude === null, 'null result (no capture attempted) → all NULL')

  // 8) Successful capture maps through untouched (no rounding in storage mapping)
  const successColumns = toVehicleCheckLocationColumns(success)
  assert(successColumns.latitude === 52.41482, 'success columns latitude')
  assert(successColumns.longitude === 0.74631, 'success columns longitude')
  assert(successColumns.accuracy === 18, 'success columns accuracy')
  assert(successColumns.locationAt === '2026-07-29T06:31:00.000Z', 'success columns locationAt')

  // 9) Admin display formatting — historical NULLs render safely, no crash
  assert(formatVehicleCheckCoordinate(null) === '—', 'null coordinate renders as em dash')
  assert(formatVehicleCheckCoordinate(undefined) === '—', 'undefined coordinate renders as em dash')
  assert(formatVehicleCheckCoordinate(52.4148201) === '52.414820', 'coordinate rounds for display only (6dp)')
  assert(formatVehicleCheckAccuracy(null) === 'Accuracy unavailable', 'null accuracy message')
  assert(formatVehicleCheckAccuracy(18.4) === '18 metres', 'accuracy rounds to whole metres for display')
  assert(
    formatVehicleCheckCoordinatePair(52.41482, 0.7463) === '52.414820, 0.746300',
    'copy-coordinates pair format',
  )
  assert(formatVehicleCheckCoordinatePair(null, 0.7463) === null, 'missing latitude → no copy pair')
  assert(formatVehicleCheckCoordinatePair(52.41482, null) === null, 'missing longitude → no copy pair')

  console.log('All vehicle check GPS capture scenarios passed.')
}

void run()
