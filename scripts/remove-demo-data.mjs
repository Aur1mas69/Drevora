/**
 * Remove only records created by scripts/seed-demo-data.mjs
 * Deletes exclusively by IDs listed in scripts/.demo-data-manifest.json.
 *
 * Usage: npm run remove:demo
 */

import {
  chunkedDeleteByIds,
  createServiceClient,
  deleteManifest,
  readManifest,
} from './demo-data-lib.mjs'

async function main() {
  console.log('DREVORA demo data removal')
  console.log('=========================')

  const manifest = readManifest()
  if (!manifest?.companyId) {
    console.log('No demo manifest found (scripts/.demo-data-manifest.json). Nothing to remove.')
    process.exit(0)
  }

  console.log(`Manifest company: ${manifest.companyName ?? '(unknown)'} (${manifest.companyId})`)
  console.log('Deleting only manifest-listed IDs (no company-wide filters).')

  const client = createServiceClient()

  const steps = [
    ['vehicle_check_items', manifest.vehicleCheckItemIds],
    ['vehicle_checks', manifest.vehicleCheckIds],
    ['driver_reports', manifest.driverReportIds],
    ['holiday_requests', manifest.holidayRequestIds],
    ['timesheet_entries', manifest.timesheetEntryIds],
    ['timesheets', manifest.timesheetIds],
  ]

  for (const [table, ids] of steps) {
    const count = await chunkedDeleteByIds(client, table, ids ?? [])
    console.log(`Deleted ${count} from ${table}`)
  }

  if (manifest.vehicleIds?.length) {
    const { error } = await client
      .from('vehicles')
      .update({ current_driver_id: null })
      .in('id', manifest.vehicleIds)
    if (error) throw new Error(`Failed to clear vehicle drivers: ${error.message}`)
  }

  if (manifest.driverIds?.length) {
    const { error } = await client
      .from('drivers')
      .update({ default_vehicle_id: null, assigned_vehicle: null })
      .in('id', manifest.driverIds)
    if (error) throw new Error(`Failed to clear driver vehicles: ${error.message}`)
  }

  const driversDeleted = await chunkedDeleteByIds(client, 'drivers', manifest.driverIds ?? [])
  console.log(`Deleted ${driversDeleted} from drivers`)

  const vehiclesDeleted = await chunkedDeleteByIds(client, 'vehicles', manifest.vehicleIds ?? [])
  console.log(`Deleted ${vehiclesDeleted} from vehicles`)

  if (manifest.companyCreatedBySeed && manifest.companyId) {
    console.log(
      'Note: companyCreatedBySeed=true in an older manifest; current seed never creates companies. Skipping company delete.',
    )
  } else {
    console.log('Company row preserved (seed never deletes the active company).')
  }

  deleteManifest()
  console.log('Manifest removed. Pre-existing records were not deleted.')
}

main().catch((error) => {
  console.error('\nRemove failed:', error.message ?? error)
  process.exit(1)
})
