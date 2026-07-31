/**
 * Native Android storage for Worker offline bootstrap JSON — Capacitor Preferences.
 *
 * Large fleets + checklist templates can exceed the Capacitor bridge /
 * Binder size limit when stored as one string. Split across keys.
 *
 * IMPORTANT: Prefer string-literal keys (not `${importedConst}:suffix`).
 * Rolldown has rewritten template-literal const aliases to the wrong binding.
 */

import { Preferences } from '@capacitor/preferences'

const ROOT_KEY = 'drevora:worker-offline-bootstrap-v1'
const TPL_INDEX_KEY = 'drevora:worker-offline-bootstrap-v1:tpl-index'
const TPL_KEY_PREFIX = 'drevora:worker-offline-bootstrap-v1:tpl:'
const HEARTBEAT_KEY = 'drevora:worker-offline-bootstrap-v1:heartbeat'

function templateKey(vehicleType: string): string {
  return TPL_KEY_PREFIX + vehicleType
}

async function readPreviousTemplateTypes(): Promise<string[]> {
  try {
    const result = await Preferences.get({ key: TPL_INDEX_KEY })
    if (!result.value) return []
    const parsed: unknown = JSON.parse(result.value)
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string')
      : []
  } catch {
    return []
  }
}

export async function readBootstrapJson(): Promise<string | null> {
  try {
    const rootResult = await Preferences.get({ key: ROOT_KEY })
    if (!rootResult.value) return null

    const root: unknown = JSON.parse(rootResult.value)
    if (!root || typeof root !== 'object') return null

    const envelope = root as Record<string, unknown>
    const indexResult = await Preferences.get({ key: TPL_INDEX_KEY })
    let types: string[] = []
    if (indexResult.value) {
      const parsed: unknown = JSON.parse(indexResult.value)
      if (Array.isArray(parsed)) {
        types = parsed.filter((entry): entry is string => typeof entry === 'string')
      }
    }

    const templateItemsByVehicleType: Record<string, unknown> = {}
    await Promise.all(
      types.map(async (vehicleType) => {
        try {
          const tpl = await Preferences.get({ key: templateKey(vehicleType) })
          if (!tpl.value) {
            templateItemsByVehicleType[vehicleType] = []
            return
          }
          const items: unknown = JSON.parse(tpl.value)
          templateItemsByVehicleType[vehicleType] = Array.isArray(items) ? items : []
        } catch {
          templateItemsByVehicleType[vehicleType] = []
        }
      }),
    )

    return JSON.stringify({
      ...envelope,
      templateItemsByVehicleType,
    })
  } catch {
    return null
  }
}

export async function writeBootstrapJson(value: string): Promise<void> {
  await Preferences.set({
    key: HEARTBEAT_KEY,
    value: String(value.length),
  })

  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid bootstrap JSON')
  }

  const envelope = parsed as Record<string, unknown>
  const templatesRaw = envelope.templateItemsByVehicleType
  const templateItemsByVehicleType =
    templatesRaw && typeof templatesRaw === 'object' && !Array.isArray(templatesRaw)
      ? (templatesRaw as Record<string, unknown>)
      : {}

  const types = Object.keys(templateItemsByVehicleType)
  const previousTypes = await readPreviousTemplateTypes()

  const rootPayload = {
    ...envelope,
    templateItemsByVehicleType: {},
  }

  await Preferences.set({
    key: ROOT_KEY,
    value: JSON.stringify(rootPayload),
  })
  await Preferences.set({
    key: TPL_INDEX_KEY,
    value: JSON.stringify(types),
  })

  await Promise.all(
    types.map((vehicleType) =>
      Preferences.set({
        key: templateKey(vehicleType),
        value: JSON.stringify(templateItemsByVehicleType[vehicleType] ?? []),
      }),
    ),
  )

  const staleTypes = previousTypes.filter((type) => !types.includes(type))
  await Promise.all(
    staleTypes.map((vehicleType) =>
      Preferences.remove({ key: templateKey(vehicleType) }).catch(() => undefined),
    ),
  )

  const verify = await Preferences.get({ key: ROOT_KEY })
  if (!verify.value) {
    throw new Error('Bootstrap Preferences write verify failed')
  }
}

export async function clearBootstrapJson(): Promise<void> {
  try {
    const previousTypes = await readPreviousTemplateTypes()
    await Preferences.remove({ key: ROOT_KEY })
    await Preferences.remove({ key: TPL_INDEX_KEY })
    await Preferences.remove({ key: HEARTBEAT_KEY })
    await Promise.all(
      previousTypes.map((vehicleType) =>
        Preferences.remove({ key: templateKey(vehicleType) }).catch(() => undefined),
      ),
    )
  } catch {
    // ignore
  }
}

export async function touchBootstrapHeartbeat(note: string): Promise<void> {
  try {
    await Preferences.set({
      key: HEARTBEAT_KEY,
      value: note.slice(0, 120),
    })
  } catch {
    // ignore
  }
}
