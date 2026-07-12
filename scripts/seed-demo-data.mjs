/**
 * Seed fictional UK transport demo data into the current company for screenshots.
 *
 * Usage:
 *   npm run seed:demo
 *   npm run seed:demo -- --dry-run
 *   npm run seed:demo -- --rebuild-manifest
 *
 * Resume: re-running `npm run seed:demo` skips every section already listed in the
 * manifest and only creates missing sections (e.g. Vehicle Checks after a partial fail).
 *
 * Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Multi-company projects also require DEMO_TARGET_COMPANY_ID.
 */

import {
  DEMO_EMAIL_DOMAIN,
  DEMO_FLEET_PREFIX,
  DEMO_SEED,
  EMPTY_MANIFEST,
  addDays,
  chunkedInsert,
  createRng,
  createServiceClient,
  makeWorkerCode,
  minutesBetween,
  pad2,
  parseArgs,
  printManifestStatus,
  readManifest,
  resolveEnv,
  resolveTargetCompany,
  sectionComplete,
  startOfUtcMonday,
  toDateString,
  writeManifest,
} from './demo-data-lib.mjs'

const FIRST_NAMES = [
  'James', 'Oliver', 'Harry', 'Jack', 'Charlie', 'George', 'Noah', 'Leo', 'Arthur', 'Oscar',
  'Emily', 'Olivia', 'Amelia', 'Isla', 'Ava', 'Mia', 'Grace', 'Sophie', 'Freya', 'Lily',
  'Thomas', 'William', 'Henry', 'Alfie', 'Theo', 'Mason', 'Logan', 'Lucas', 'Ethan', 'Daniel',
]

const LAST_NAMES = [
  'Hartley', 'Whitmore', 'Bradshaw', 'Cartwright', 'Pemberton', 'Fairfax', 'Ashworth',
  'Kensington', 'Rowntree', 'Sinclair', 'Hawthorne', 'Belmont', 'Caldwell', 'Drayton',
  'Ellison', 'Fenwick', 'Gresham', 'Hollis', 'Ingram', 'Jarvis', 'Kingsley', 'Langford',
  'Merrick', 'Northam', 'Oakley', 'Pritchard', 'Quinton', 'Ramsay', 'Sutcliffe', 'Telford',
]

const EMPLOYMENT_TYPES = [
  'Full-time',
  'Full-time',
  'Full-time',
  'Part-time',
  'Part-time',
  'Umbrella',
  'Umbrella',
  'Self-employed / Contractor',
  'Self-employed / Contractor',
]

const DRIVER_PROFILES = [
  { role: 'Driver', licence: ['C+E'], label: 'Class 1' },
  { role: 'Driver', licence: ['C+E'], label: 'Class 1' },
  { role: 'Driver', licence: ['C'], label: 'Class 2' },
  { role: 'Driver', licence: ['C'], label: 'Class 2' },
  { role: 'Warehouse', licence: ['B'], label: 'Forklift' },
  { role: 'Yardman', licence: ['B'], label: 'Forklift' },
]

const HGV_SPECS = [
  { type: 'Artic Tractor Unit', make: 'Scania', model: 'R450' },
  { type: 'Artic Tractor Unit', make: 'Volvo', model: 'FH460' },
  { type: 'Artic Tractor Unit', make: 'DAF', model: 'XF480' },
  { type: '18t Rigid', make: 'Mercedes-Benz', model: 'Actros 1832' },
  { type: '26t Rigid', make: 'MAN', model: 'TGX 26.440' },
  { type: '32t Rigid', make: 'Iveco', model: 'S-Way' },
  { type: 'Volumetric Concrete Mixer', make: 'Mercedes-Benz', model: 'Arocs' },
  { type: 'Tipper', make: 'DAF', model: 'CF 440' },
  { type: 'Grab Lorry', make: 'Volvo', model: 'FM 420' },
  { type: 'Flatbed Lorry', make: 'Scania', model: 'P410' },
  { type: 'Curtain Side Lorry', make: 'MAN', model: 'TGS' },
  { type: 'Box Lorry', make: 'Iveco', model: 'Eurocargo' },
]

const FORKLIFT_SPECS = [
  { type: 'Forklift', make: 'Toyota', model: '8FDF25' },
  { type: 'Forklift', make: 'Linde', model: 'H25D' },
  { type: 'Forklift', make: 'Jungheinrich', model: 'DFG430' },
  { type: 'Forklift', make: 'Hyster', model: 'H2.5FT' },
  { type: 'Forklift', make: 'Caterpillar', model: 'DP25N' },
]

const REPORT_TYPES = [
  'Vehicle issue',
  'Damage',
  'Load / cargo issue',
  'Site / customer issue',
]

const REPORT_TITLES = {
  'Vehicle issue': [
    'ABS warning light on dash',
    'Air leak from trailer coupling',
    'Engine temperature rising under load',
  ],
  Damage: [
    'Nearside rear panel scuffed at depot',
    'Mirror arm cracked after tight turn',
    'Curtain strap torn on yard',
  ],
  'Load / cargo issue': [
    'Pallet shifted in transit',
    'Load restraint strap failed inspection',
    'Mixed consignment labels mismatched',
  ],
  'Site / customer issue': [
    'Site gate delayed collection',
    'Customer refused unsigned POD',
    'Unsafe unloading bay reported',
  ],
}

const DAILY_COMMENTS = [
  'Multi-drop London run — traffic heavy on A13.',
  'Night trunk to Midlands DC.',
  'Waiting time at customer: 45 mins.',
  'Fuel stop at Rugby services.',
  'Assisted yard shunt before departure.',
  null,
  null,
  null,
]

/** Live vehicle_check_items columns (original create migration). Do not send allow_* fields. */
const DEFAULT_CHECK_ITEMS = [
  { category: 'Vehicle exterior', item_name: 'Lights and indicators' },
  { category: 'Vehicle exterior', item_name: 'Tyres and wheel nuts' },
  { category: 'Vehicle exterior', item_name: 'Mirrors and glass' },
  { category: 'Vehicle exterior', item_name: 'Bodywork and panels' },
  { category: 'Cab / interior', item_name: 'Seat belts' },
  { category: 'Cab / interior', item_name: 'Wipers and washers' },
  { category: 'Cab / interior', item_name: 'Horn' },
  { category: 'Under vehicle', item_name: 'Fluid leaks' },
  { category: 'Under vehicle', item_name: 'Exhaust security' },
  { category: 'Load / equipment', item_name: 'Load security equipment' },
  { category: 'Documents', item_name: 'Licence and tachograph card' },
  { category: 'Documents', item_name: 'Walkaround sheet complete' },
]

function ukPhone(rng, index) {
  const n = 7000000000 + index * 13751 + rng.int(0, 900)
  const s = String(n)
  return `0${s.slice(0, 4)} ${s.slice(4, 7)} ${s.slice(7)}`
}

function ukRegistration(rng, index) {
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ'
  const age = ['12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '23', '24']
  const a = letters[(index * 3) % letters.length]
  const b = letters[(index * 7 + 5) % letters.length]
  const ageCode = age[index % age.length]
  const c = letters[rng.int(0, letters.length - 1)]
  const d = letters[rng.int(0, letters.length - 1)]
  const e = letters[rng.int(0, letters.length - 1)]
  return `${a}${b}${ageCode} ${c}${d}${e}`
}

function dateOffsetYears(base, yearsFromNow, rng) {
  const d = addDays(base, Math.round(yearsFromNow * 365) + rng.int(-40, 40))
  return toDateString(d)
}

function buildVehiclePlan(rng) {
  const statuses = [
    ...Array(27).fill('Available'),
    ...Array(4).fill('Maintenance'),
    ...Array(4).fill('Off Road'),
  ]
  const shuffledStatuses = rng.shuffle(statuses)

  const plan = []
  for (let i = 0; i < 30; i += 1) {
    const spec = HGV_SPECS[i % HGV_SPECS.length]
    plan.push({
      ...spec,
      status: shuffledStatuses[i],
      index: i,
      isForklift: false,
    })
  }
  for (let i = 0; i < 5; i += 1) {
    const spec = FORKLIFT_SPECS[i]
    plan.push({
      ...spec,
      status: shuffledStatuses[30 + i],
      index: 30 + i,
      isForklift: true,
    })
  }
  return plan
}

function buildWorkerPlan(rng) {
  const plan = []
  for (let i = 0; i < 30; i += 1) {
    const profile = DRIVER_PROFILES[i % DRIVER_PROFILES.length]
    plan.push({
      firstName: FIRST_NAMES[i % FIRST_NAMES.length],
      lastName: LAST_NAMES[i % LAST_NAMES.length],
      employmentType: EMPLOYMENT_TYPES[i % EMPLOYMENT_TYPES.length],
      role: profile.role,
      licence: profile.licence,
      profileLabel: profile.label,
      index: i,
    })
  }
  return rng.shuffle(plan).map((row, index) => ({ ...row, index }))
}

function saveProgress(manifest) {
  writeManifest(manifest)
}

async function loadChecklistItems(client, vehicleType) {
  const { data: templates, error } = await client
    .from('vehicle_check_templates')
    .select('id, vehicle_type, company, is_active')
    .eq('is_active', true)
    .limit(80)

  if (error) {
    console.warn(`  Template lookup warning (${vehicleType}): ${error.message}`)
    return DEFAULT_CHECK_ITEMS
  }

  const rows = templates ?? []
  const preferred =
    rows.find((row) => row.vehicle_type === vehicleType && row.company == null) ||
    rows.find((row) => row.vehicle_type === vehicleType) ||
    rows.find((row) => row.company == null) ||
    rows[0]

  if (!preferred) return DEFAULT_CHECK_ITEMS

  const { data: items, error: itemsError } = await client
    .from('vehicle_check_template_items')
    .select('section, label, is_active, sort_order')
    .eq('template_id', preferred.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (itemsError || !items?.length) return DEFAULT_CHECK_ITEMS

  return items.map((item) => ({
    category: item.section,
    item_name: item.label,
  }))
}

function buildPlannedRows(company, rng) {
  const today = new Date()
  const vehiclePlan = buildVehiclePlan(rng)
  const workerPlan = buildWorkerPlan(rng)

  const vehicleRows = vehiclePlan.map((v) => {
    const fleetNumber = `${DEMO_FLEET_PREFIX}${pad2(v.index + 1)}`
    const year = 2016 + (v.index % 9)
    const odometer = v.isForklift
      ? 1200 + v.index * 180 + rng.int(0, 400)
      : 180000 + v.index * 4200 + rng.int(0, 9000)

    return {
      registration: ukRegistration(rng, v.index),
      fleet_number: fleetNumber,
      make: v.make,
      model: v.model,
      year,
      vin: `DEMO${String(100000000 + v.index * 137).slice(0, 9)}UK${pad2(v.index)}`,
      current_odometer: odometer,
      status: v.status,
      availability_status: v.status,
      vehicle_type: v.type,
      notes: `[DEMO] Screenshot fleet for ${company.name}`,
      current_driver_id: null,
      off_road_reason: v.status === 'Off Road' ? 'Awaiting workshop parts' : null,
      off_road_start_date:
        v.status === 'Off Road' ? toDateString(addDays(today, -rng.int(3, 18))) : null,
      off_road_expected_return_date:
        v.status === 'Off Road' ? toDateString(addDays(today, rng.int(5, 21))) : null,
      off_road_notes: v.status === 'Off Road' ? '[DEMO] Temporary off-road for screenshots' : null,
      insurance_expiry: dateOffsetYears(today, 0.6, rng),
      mot_expiry: dateOffsetYears(today, 0.4, rng),
      road_tax_expiry: dateOffsetYears(today, 0.5, rng),
      tachograph_expiry: v.isForklift ? null : dateOffsetYears(today, 0.9, rng),
    }
  })

  const driverRows = workerPlan.map((w, i) => {
    const email = `${w.firstName}.${w.lastName}.${i}@${DEMO_EMAIL_DOMAIN}`.toLowerCase()
    return {
      first_name: w.firstName,
      last_name: w.lastName,
      email,
      phone: ukPhone(rng, i),
      company: company.scopeName,
      role: w.role,
      status: rng.pick(['Working', 'Working', 'Working', 'Off Duty']),
      employment_type: w.employmentType,
      worker_code: makeWorkerCode(rng, i + 11),
      assigned_vehicle: null,
      default_vehicle_id: null,
      start_date: dateOffsetYears(today, -(1 + (i % 8) * 0.35), rng),
      driving_licence_expiry: dateOffsetYears(today, 1.5 + (i % 5) * 0.2, rng),
      cpc_expiry: dateOffsetYears(today, 0.8 + (i % 4) * 0.25, rng),
      driver_card_expiry: dateOffsetYears(today, 1.1 + (i % 3) * 0.2, rng),
      medical_expiry: dateOffsetYears(today, 0.7 + (i % 6) * 0.15, rng),
      licence_categories: w.licence,
      tacho_card_number: w.role === 'Driver' ? `UK${1000000 + i * 17}` : null,
      paid_holiday_enabled: w.employmentType === 'Full-time' || w.employmentType === 'Part-time',
      annual_paid_holiday_days:
        w.employmentType === 'Full-time' ? 28 : w.employmentType === 'Part-time' ? 14 : 0,
      bank_holiday_entitlement_days: w.employmentType === 'Full-time' ? 8 : 0,
      unpaid_leave_allowed: true,
      address_line_1: `${10 + i} Demo Close`,
      town_city: rng.pick(['Birmingham', 'Coventry', 'Wolverhampton', 'Solihull']),
      county: 'West Midlands',
      postcode: `B${10 + (i % 40)} ${1 + (i % 9)}AA`,
      country: 'United Kingdom',
      holiday_entitlement_notes: `[DEMO] ${w.profileLabel} profile`,
      _vehicleIndex: i < 28 ? i : null,
    }
  })

  return { today, vehicleRows, driverRows }
}

/**
 * Recover a manifest from deterministic DEMO markers already in the DB.
 * Does not invent IDs — only selects rows matching seed markers.
 */
async function rebuildManifestFromMarkers(client, company) {
  console.log('Rebuilding manifest from DEMO markers (no inserts)...')

  const manifest = EMPTY_MANIFEST()
  manifest.createdAt = new Date().toISOString()
  manifest.companyId = company.id
  manifest.companyName = company.scopeName
  manifest.companyCreatedBySeed = false

  const { data: vehicles, error: vehicleError } = await client
    .from('vehicles')
    .select('id, fleet_number')
    .like('fleet_number', `${DEMO_FLEET_PREFIX}%`)
    .order('fleet_number', { ascending: true })

  if (vehicleError) throw new Error(`Vehicle discovery failed: ${vehicleError.message}`)
  manifest.vehicleIds = (vehicles ?? []).map((row) => row.id)

  const { data: drivers, error: driverError } = await client
    .from('drivers')
    .select('id, email')
    .ilike('email', `%@${DEMO_EMAIL_DOMAIN}`)
    .order('email', { ascending: true })

  if (driverError) throw new Error(`Driver discovery failed: ${driverError.message}`)
  manifest.driverIds = (drivers ?? []).map((row) => row.id)

  if (manifest.driverIds.length) {
    const { data: timesheets, error: timesheetError } = await client
      .from('timesheets')
      .select('id')
      .in('driver_id', manifest.driverIds)

    if (timesheetError) throw new Error(`Timesheet discovery failed: ${timesheetError.message}`)
    manifest.timesheetIds = (timesheets ?? []).map((row) => row.id)

    if (manifest.timesheetIds.length) {
      const { data: entries, error: entryError } = await client
        .from('timesheet_entries')
        .select('id')
        .in('timesheet_id', manifest.timesheetIds)

      if (entryError) throw new Error(`Timesheet entry discovery failed: ${entryError.message}`)
      manifest.timesheetEntryIds = (entries ?? []).map((row) => row.id)
    }

    const { data: holidays, error: holidayError } = await client
      .from('holiday_requests')
      .select('id, reason')
      .in('worker_id', manifest.driverIds)
      .like('reason', '[DEMO]%')

    if (holidayError) throw new Error(`Holiday discovery failed: ${holidayError.message}`)
    manifest.holidayRequestIds = (holidays ?? []).map((row) => row.id)
  }

  const { data: reports, error: reportError } = await client
    .from('driver_reports')
    .select('id')
    .eq('company', company.scopeName)
    .like('description', '[DEMO]%')

  if (reportError) throw new Error(`Driver report discovery failed: ${reportError.message}`)
  manifest.driverReportIds = (reports ?? []).map((row) => row.id)

  if (manifest.vehicleIds.length) {
    const { data: checks, error: checkError } = await client
      .from('vehicle_checks')
      .select('id')
      .in('vehicle_id', manifest.vehicleIds)
      .like('notes', '[DEMO]%')

    if (checkError) throw new Error(`Vehicle check discovery failed: ${checkError.message}`)
    manifest.vehicleCheckIds = (checks ?? []).map((row) => row.id)

    if (manifest.vehicleCheckIds.length) {
      const { data: items, error: itemError } = await client
        .from('vehicle_check_items')
        .select('id')
        .in('vehicle_check_id', manifest.vehicleCheckIds)

      if (itemError) throw new Error(`Vehicle check item discovery failed: ${itemError.message}`)
      manifest.vehicleCheckItemIds = (items ?? []).map((row) => row.id)
    }
  }

  saveProgress(manifest)
  console.log('Manifest rebuilt and written to scripts/.demo-data-manifest.json')
  printManifestStatus(manifest)
  return manifest
}

async function seedVehicleChecks(client, manifest, rng) {
  const vehicleIds = manifest.vehicleIds
  const driverIds = manifest.driverIds
  if (!vehicleIds?.length || !driverIds?.length) {
    throw new Error(
      'Cannot seed vehicle checks: manifest is missing vehicleIds and/or driverIds.',
    )
  }

  const { data: vehicleMeta, error: metaError } = await client
    .from('vehicles')
    .select('id, vehicle_type, current_odometer')
    .in('id', vehicleIds)

  if (metaError) throw new Error(`Failed to load demo vehicles: ${metaError.message}`)

  const vehicleById = new Map((vehicleMeta ?? []).map((row) => [row.id, row]))
  const checklistCache = new Map()

  async function itemsForType(type) {
    if (!checklistCache.has(type)) {
      checklistCache.set(type, await loadChecklistItems(client, type))
    }
    return checklistCache.get(type)
  }

  const today = new Date()
  const checkIds = [...(manifest.vehicleCheckIds ?? [])]
  const checkItemIds = [...(manifest.vehicleCheckItemIds ?? [])]
  const already = checkIds.length
  const target = 40
  const toCreate = Math.max(0, target - already)

  if (toCreate === 0) {
    console.log('Vehicle checks already complete in manifest — skipping.')
    return
  }

  console.log(`Creating ${toCreate} vehicle checks (already have ${already})...`)

  for (let n = 0; n < toCreate; n += 1) {
    const i = already + n
    const vehicleId = vehicleIds[i % vehicleIds.length]
    const workerId = driverIds[i % driverIds.length]
    const meta = vehicleById.get(vehicleId) ?? {}
    const vehicleType = meta.vehicle_type || 'Other'
    const templateItems = await itemsForType(vehicleType)
    const dayOffset = -(i % 14)
    const inspectionDate = toDateString(addDays(today, dayOffset))
    const startHour = 5 + (i % 10)
    const started = new Date(`${inspectionDate}T${pad2(startHour)}:${pad2(10 + (i % 40))}:00Z`)
    const durationSeconds = 480 + (i % 12) * 75
    const completed = new Date(started.getTime() + durationSeconds * 1000)
    const hasDefect = i % 7 === 0 || i % 11 === 0
    const overallResult = hasDefect ? (i % 14 === 0 ? 'Fail' : 'Advisory') : 'Pass'
    const odometer = (meta.current_odometer ?? 100000) - rng.int(20, 400)

    // Only columns that exist on live vehicle_check_items (no allow_notes / allow_photo / fail_on_defect / guidance)
    const itemPayload = templateItems.map((item, itemIndex) => {
      let result = 'Pass'
      let comment = null
      if (hasDefect && itemIndex === i % templateItems.length) {
        result = overallResult === 'Fail' ? 'Fail' : 'Advisory'
        comment = '[DEMO] Sample defect for screenshots'
      }
      return {
        category: item.category,
        item_name: item.item_name,
        result,
        comment,
        photo_url: null,
      }
    })

    const { data: checkRow, error: checkError } = await client
      .from('vehicle_checks')
      .insert({
        vehicle_id: vehicleId,
        worker_id: workerId,
        inspection_date: inspectionDate,
        odometer,
        odometer_unit: 'miles',
        status: 'Completed',
        overall_result: overallResult,
        notes: '[DEMO] Walkaround check for screenshots',
        inspection_started_at: started.toISOString(),
        inspection_completed_at: completed.toISOString(),
        duration_seconds: durationSeconds,
        signature_url: null,
        signed_at: completed.toISOString(),
      })
      .select('id')
      .single()

    if (checkError || !checkRow) {
      // Retry without optional columns if some duration/signature cols are missing
      const { data: fallbackRow, error: fallbackError } = await client
        .from('vehicle_checks')
        .insert({
          vehicle_id: vehicleId,
          worker_id: workerId,
          inspection_date: inspectionDate,
          odometer,
          status: 'Completed',
          overall_result: overallResult,
          notes: '[DEMO] Walkaround check for screenshots',
        })
        .select('id')
        .single()

      if (fallbackError || !fallbackRow) {
        throw new Error(
          `Vehicle check insert failed: ${checkError?.message ?? fallbackError?.message ?? 'unknown'}`,
        )
      }

      checkIds.push(fallbackRow.id)
      const itemRows = itemPayload.map((item) => ({
        vehicle_check_id: fallbackRow.id,
        ...item,
      }))
      const insertedItemIds = await chunkedInsert(client, 'vehicle_check_items', itemRows, 100)
      checkItemIds.push(...insertedItemIds)
    } else {
      checkIds.push(checkRow.id)
      const itemRows = itemPayload.map((item) => ({
        vehicle_check_id: checkRow.id,
        ...item,
      }))
      const insertedItemIds = await chunkedInsert(client, 'vehicle_check_items', itemRows, 100)
      checkItemIds.push(...insertedItemIds)
    }

    // Persist after each successful check so a mid-loop failure still keeps IDs
    manifest.vehicleCheckIds = checkIds
    manifest.vehicleCheckItemIds = checkItemIds
    saveProgress(manifest)
  }

  console.log(`Vehicle checks created: ${toCreate} (total ${checkIds.length})`)
  console.log(`Vehicle check items total: ${checkItemIds.length}`)
}

async function main() {
  const { dryRun, rebuildManifest } = parseArgs()
  console.log(
    dryRun
      ? 'DREVORA demo seed (dry-run / validate)'
      : rebuildManifest
        ? 'DREVORA demo seed (rebuild manifest)'
        : 'DREVORA demo seed',
  )
  console.log('=========================================')

  let client = null
  let company = null
  let env = process.env

  try {
    ;({ env } = resolveEnv())
    client = createServiceClient()
    company = await resolveTargetCompany(client, env)
  } catch (error) {
    if (!dryRun) throw error
    console.warn(`Company lookup skipped: ${error.message}`)
    company = {
      id: '00000000-0000-0000-0000-000000000000',
      name: '(credentials required to resolve live company)',
      scopeName: '(credentials required)',
      selection: 'dry-run-stub',
    }
  }

  console.log(`Selected company name: ${company.name}`)
  console.log(`Selected company id:   ${company.id}`)
  console.log(`Selection mode:        ${company.selection}`)
  console.log(`Company scope text:    ${company.scopeName}`)

  if (rebuildManifest) {
    if (dryRun) {
      console.log('Dry-run: would rebuild manifest from DEMO markers (no write).')
      return
    }
    await rebuildManifestFromMarkers(client, company)
    console.log('\nNext: run `npm run seed:demo` to resume only missing sections (Vehicle Checks).')
    return
  }

  let manifest = readManifest()

  if (!manifest) {
    console.error('\nCRITICAL: scripts/.demo-data-manifest.json is MISSING.')
    console.error(
      'The previous seed created vehicles/workers/timesheets/holidays/reports but crashed before writing the manifest.',
    )
    console.error('Missing: entire manifest (all section ID lists).')
    console.error('\nDo not re-seed from scratch (that would duplicate data).')
    console.error('Recover IDs from DEMO markers first, then resume:')
    console.error('  1) npm run seed:demo -- --rebuild-manifest')
    console.error('  2) npm run seed:demo')
    if (dryRun) {
      console.log('\nDry-run continues with local plan validation only (no inserts).')
      const rng = createRng(DEMO_SEED)
      const planned = buildPlannedRows(company, rng)
      console.log(`  Planned workers:  ${planned.driverRows.length}`)
      console.log(`  Planned vehicles: ${planned.vehicleRows.length}`)
      console.log('  vehicle_check_items insert columns: category, item_name, result, comment, photo_url')
      console.log('  (allow_notes / allow_photo / fail_on_defect / guidance are NOT inserted)')
      console.log('\nValidation OK. No records inserted.')
      return
    }
    process.exit(1)
  }

  console.log('\nCurrent manifest status:')
  printManifestStatus(manifest)

  const coreReady =
    sectionComplete(manifest, 'vehicleIds', 35) &&
    sectionComplete(manifest, 'driverIds', 30) &&
    sectionComplete(manifest, 'timesheetIds', 100) &&
    sectionComplete(manifest, 'timesheetEntryIds', 700) &&
    sectionComplete(manifest, 'holidayRequestIds', 20) &&
    sectionComplete(manifest, 'driverReportIds', 20)

  const checksReady = sectionComplete(manifest, 'vehicleCheckIds', 40)

  if (dryRun) {
    const rng = createRng(DEMO_SEED)
    const planned = buildPlannedRows(company, rng)
    console.log('\nDry-run plan (no inserts):')
    console.log(`  Skip vehicles:          ${sectionComplete(manifest, 'vehicleIds', 35)}`)
    console.log(`  Skip workers:           ${sectionComplete(manifest, 'driverIds', 30)}`)
    console.log(`  Skip timesheets:        ${sectionComplete(manifest, 'timesheetIds', 100)}`)
    console.log(`  Skip holidays:          ${sectionComplete(manifest, 'holidayRequestIds', 20)}`)
    console.log(`  Skip driver reports:    ${sectionComplete(manifest, 'driverReportIds', 20)}`)
    console.log(
      `  Create vehicle checks:  ${checksReady ? 0 : Math.max(0, 40 - (manifest.vehicleCheckIds?.length ?? 0))}`,
    )
    console.log(`  Planned worker draft:   ${planned.driverRows.length}`)
    console.log(`  Planned vehicle draft:  ${planned.vehicleRows.length}`)
    console.log('\nValidation OK. No records inserted.')
    return
  }

  // Full completion
  if (coreReady && checksReady) {
    console.log('\nAll demo sections already present in manifest. Nothing to do.')
    return
  }

  // Resume path: core present, checks missing
  if (coreReady && !checksReady) {
    console.log('\nResuming: core demo sections found — seeding Vehicle Checks only.')
    const rng = createRng(DEMO_SEED)
    await seedVehicleChecks(client, manifest, rng)
    console.log('\nResume complete.')
    printManifestStatus(readManifest())
    return
  }

  // Incomplete core without enough IDs — refuse to invent
  if (!coreReady && (manifest.vehicleIds?.length || manifest.driverIds?.length)) {
    console.error('\nManifest exists but core sections are incomplete:')
    printManifestStatus(manifest)
    console.error('Refusing to invent missing IDs. Inspect the manifest or rebuild from markers:')
    console.error('  npm run seed:demo -- --rebuild-manifest')
    process.exit(1)
  }

  // Fresh seed (empty / near-empty manifest)
  if (manifest.vehicleIds?.length || manifest.driverIds?.length) {
    console.error('Unexpected partial manifest without core completion. Aborting.')
    process.exit(1)
  }

  const rng = createRng(DEMO_SEED)
  manifest = EMPTY_MANIFEST()
  manifest.createdAt = new Date().toISOString()
  manifest.companyId = company.id
  manifest.companyName = company.scopeName
  manifest.companyCreatedBySeed = false
  saveProgress(manifest)

  const { today, vehicleRows, driverRows } = buildPlannedRows(company, rng)

  for (const driver of driverRows) {
    if (driver._vehicleIndex == null) continue
    const vehicle = vehicleRows[driver._vehicleIndex]
    driver.assigned_vehicle = vehicle.registration
  }

  const vehicleIds = await chunkedInsert(client, 'vehicles', vehicleRows)
  manifest.vehicleIds = vehicleIds
  saveProgress(manifest)
  console.log(`Vehicles created: ${vehicleIds.length}`)

  const driverInsertRows = driverRows.map((driver) => {
    const { _vehicleIndex, ...row } = driver
    return {
      ...row,
      default_vehicle_id: _vehicleIndex != null ? vehicleIds[_vehicleIndex] : null,
    }
  })

  const driverIds = await chunkedInsert(client, 'drivers', driverInsertRows)
  manifest.driverIds = driverIds
  saveProgress(manifest)
  console.log(`Workers created: ${driverIds.length}`)

  for (let i = 0; i < Math.min(driverIds.length, vehicleIds.length); i += 1) {
    if (vehicleRows[i].status !== 'Available') continue
    const { error } = await client
      .from('vehicles')
      .update({ current_driver_id: driverIds[i] })
      .eq('id', vehicleIds[i])
    if (error) console.warn(`  Vehicle assign warning: ${error.message}`)
  }

  const monday = startOfUtcMonday(today)
  const weekStarts = []
  for (let w = 1; w <= 12; w += 1) {
    weekStarts.push(toDateString(addDays(monday, -7 * w)))
  }

  const timesheetStatuses = rng.shuffle([
    ...Array(15).fill('Draft'),
    ...Array(20).fill('Submitted'),
    ...Array(55).fill('Approved'),
    ...Array(10).fill('Rejected'),
  ])

  const timesheetPairs = []
  outer: for (const weekStart of weekStarts) {
    for (let d = 0; d < driverIds.length; d += 1) {
      timesheetPairs.push({ driverId: driverIds[d], weekStart, driverIndex: d })
      if (timesheetPairs.length >= 100) break outer
    }
  }

  const timesheetRows = timesheetPairs.map((pair, i) => {
    const status = timesheetStatuses[i]
    const vehicleId = driverInsertRows[pair.driverIndex].default_vehicle_id
    const base = {
      driver_id: pair.driverId,
      vehicle_id: vehicleId,
      week_start: pair.weekStart,
      status,
      notes: i % 7 === 0 ? '[DEMO] Week notes for screenshot data' : null,
      bonus_amount: 0,
      submitted_at: null,
      approved_at: null,
      rejected_at: null,
    }
    const weekDate = new Date(`${pair.weekStart}T12:00:00Z`)
    if (status === 'Submitted' || status === 'Approved' || status === 'Rejected') {
      base.submitted_at = addDays(weekDate, 5).toISOString()
    }
    if (status === 'Approved') base.approved_at = addDays(weekDate, 6).toISOString()
    if (status === 'Rejected') base.rejected_at = addDays(weekDate, 6).toISOString()
    return base
  })

  const timesheetIds = await chunkedInsert(client, 'timesheets', timesheetRows)
  manifest.timesheetIds = timesheetIds
  saveProgress(manifest)
  console.log(`Timesheets created: ${timesheetIds.length}`)

  const entryRows = []
  for (let i = 0; i < timesheetIds.length; i += 1) {
    const timesheetId = timesheetIds[i]
    const weekStart = timesheetPairs[i].weekStart
    const pattern = i % 11
    for (let day = 0; day < 7; day += 1) {
      const dayDate = toDateString(addDays(new Date(`${weekStart}T12:00:00Z`), day))
      const isWeekend = day >= 5
      let start = null
      let finish = null
      let breakMinutes = 30
      let overtimeMinutes = 0
      let dailyComment = null

      if (!isWeekend || pattern === 3) {
        if (pattern === 2 && day === 2) {
          start = '22:00'
          finish = '06:00'
          breakMinutes = 45
          overtimeMinutes = 60
        } else if (pattern === 5 && day === 3) {
          start = '06:00'
          finish = '18:30'
          breakMinutes = 45
          overtimeMinutes = 90
        } else {
          start = '07:00'
          finish = '16:00'
          breakMinutes = 30
          overtimeMinutes = pattern === 7 && day === 1 ? 45 : 0
        }
        dailyComment = DAILY_COMMENTS[(i + day) % DAILY_COMMENTS.length]
      }

      const worked = start && finish ? minutesBetween(start, finish) - breakMinutes : 0
      entryRows.push({
        timesheet_id: timesheetId,
        day_date: dayDate,
        start_time: start,
        finish_time: finish,
        break_minutes: breakMinutes,
        total_minutes: Math.max(0, worked),
        overtime_minutes: overtimeMinutes,
        payroll_minutes: Math.max(0, worked),
        additional_hours: 0,
        daily_comment: dailyComment,
      })
    }
  }

  const timesheetEntryIds = await chunkedInsert(client, 'timesheet_entries', entryRows, 100)
  manifest.timesheetEntryIds = timesheetEntryIds
  saveProgress(manifest)
  console.log(`Timesheet entries created: ${timesheetEntryIds.length}`)

  const holidayStatuses = rng.shuffle([
    ...Array(6).fill('Pending'),
    ...Array(10).fill('Approved'),
    ...Array(4).fill('Rejected'),
  ])

  const holidayRows = []
  for (let i = 0; i < 20; i += 1) {
    const workerId = driverIds[i % driverIds.length]
    const status = holidayStatuses[i]
    const startOffset = rng.int(-90, 120)
    const length = rng.int(1, 7)
    const start = addDays(today, startOffset)
    const end = addDays(start, length - 1)
    holidayRows.push({
      worker_id: workerId,
      start_date: toDateString(start),
      end_date: toDateString(end),
      total_days: length,
      holiday_days_deducted: length,
      calendar_days_total: length,
      non_working_days_excluded: 0,
      reason: rng.pick([
        '[DEMO] Family holiday',
        '[DEMO] Personal appointment week',
        '[DEMO] Annual leave block',
        '[DEMO] Short break',
      ]),
      status,
      manager_note:
        status === 'Rejected'
          ? '[DEMO] Cover unavailable that week'
          : status === 'Approved'
            ? '[DEMO] Approved for roster'
            : null,
      leave_type: 'paid_holiday',
      is_paid_leave: true,
    })
  }

  const holidayRequestIds = await chunkedInsert(client, 'holiday_requests', holidayRows)
  manifest.holidayRequestIds = holidayRequestIds
  saveProgress(manifest)
  console.log(`Holiday requests created: ${holidayRequestIds.length}`)

  const reportStatuses = rng.shuffle([
    ...Array(7).fill('New'),
    ...Array(7).fill('In Progress'),
    ...Array(6).fill('Closed'),
  ])

  const reportRows = []
  for (let i = 0; i < 20; i += 1) {
    const reportType = REPORT_TYPES[i % REPORT_TYPES.length]
    const titles = REPORT_TITLES[reportType]
    reportRows.push({
      company: company.scopeName,
      worker_id: driverIds[i % driverIds.length],
      vehicle_id: vehicleIds[i % vehicleIds.length],
      title: titles[i % titles.length],
      report_type: reportType,
      priority: rng.pick(['Low', 'Medium', 'Medium', 'High', 'Critical']),
      status: reportStatuses[i],
      description: `[DEMO] Screenshot sample report for ${reportType.toLowerCase()}. No real incident.`,
      location: rng.pick([
        'Birmingham depot',
        'M6 J4 services',
        'Customer site — Coventry',
        'Yard lane 3',
      ]),
      issue_datetime: addDays(today, -rng.int(1, 40)).toISOString(),
      office_notes: reportStatuses[i] === 'Closed' ? '[DEMO] Closed after review' : null,
    })
  }

  const driverReportIds = await chunkedInsert(client, 'driver_reports', reportRows)
  manifest.driverReportIds = driverReportIds
  saveProgress(manifest)
  console.log(`Driver reports created: ${driverReportIds.length}`)

  await seedVehicleChecks(client, manifest, rng)

  console.log('\nSummary')
  console.log('-------')
  printManifestStatus(readManifest())
  console.log('\nManifest: scripts/.demo-data-manifest.json')
}

main().catch((error) => {
  console.error('\nSeed failed:', error.message ?? error)
  process.exit(1)
})
