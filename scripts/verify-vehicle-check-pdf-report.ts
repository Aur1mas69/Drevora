/**
 * Generates a realistic Vehicle Check PDF for layout verification.
 * Uses fixture data only — does not read or change stored checks.
 * Run: npx tsx scripts/verify-vehicle-check-pdf-report.ts
 */
import { deflateSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DREVORA_RECOMMENDED_PACKS } from '../src/lib/defaultDrevoraRecommendedCheckItems.ts'
import { getDefaultDvsaVehicleCheckItems } from '../src/lib/defaultDvsaVehicleCheckItems.ts'
import { getDefaultTrailerBaseCheckItems } from '../src/lib/defaultTrailerBaseCheckItems.ts'
import { formatExportGeneratedAt } from '../src/lib/export/exportMeta.ts'
import {
  measurePdfImageSize,
  renderVehicleCheckPdfDocument,
} from '../src/lib/export/vehicleCheckPdfReport.ts'
import type { VehicleCheck, VehicleCheckItem } from '../src/lib/vehicleCheckTypes.ts'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function rgbPngDataUrl(
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number],
): string {
  const stride = width * 3 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(x, y)
      const i = y * stride + 1 + x * 3
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
  return `data:image/png;base64,${png.toString('base64')}`
}

const root = fileURLToPath(new URL('..', import.meta.url))
const logoPath = join(root, 'src/assets/drevora-logo-full.png')
const logoDataUrl = `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`

const samplePhotoA = rgbPngDataUrl(480, 360, (x, y) => {
  const band = Math.floor(y / 40) % 2 === 0
  return band ? [196, 72, 54] : [232, 168, 120]
})
const samplePhotoB = rgbPngDataUrl(480, 360, (x, y) => {
  const band = Math.floor(x / 40) % 2 === 0
  return band ? [36, 92, 148] : [168, 196, 220]
})
const sampleSignature = rgbPngDataUrl(640, 200, (x, y) => {
  const wave = Math.abs(y - (100 + Math.sin(x / 28) * 36))
  return wave < 5 ? [28, 38, 58] : [255, 255, 255]
})

function itemFromTemplate(
  template: { section: string; label: string },
  index: number,
  overrides: Partial<VehicleCheckItem> = {},
): VehicleCheckItem {
  return {
    id: `item-${index + 1}`,
    vehicleCheckId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    category: template.section,
    itemName: template.label,
    result: 'Pass',
    comment: null,
    photoUrl: null,
    description: null,
    allowNotes: true,
    allowPhoto: true,
    failOnDefect: true,
    assetScope: template.section === 'Trailer' ? 'trailer' : 'vehicle',
    ...overrides,
  }
}

const dvsa = getDefaultDvsaVehicleCheckItems()
const trailer = getDefaultTrailerBaseCheckItems()
const recommended = DREVORA_RECOMMENDED_PACKS.Curtainsider.slice(0, 3)

const items: VehicleCheckItem[] = [
  ...dvsa.map((template, index) => itemFromTemplate(template, index)),
  ...trailer.map((template, index) =>
    itemFromTemplate(template, dvsa.length + index),
  ),
  ...recommended.map((template, index) =>
    itemFromTemplate(template, dvsa.length + trailer.length + index, {
      category: 'DREVORA Recommended',
      assetScope: 'trailer',
    }),
  ),
]

items[1] = {
  ...items[1],
  result: 'Advisory',
  comment: 'Washer jet blocked on the passenger side. Topped up fluid; still weak spray.',
  photoUrl: 'fixture/wipers.jpg',
}
items[12] = {
  ...items[12],
  result: 'Advisory',
  comment: 'Offside rear lamp cracked. Still illuminated. Repair booked.',
  photoUrl: 'fixture/lights.jpg',
}
items[8] = {
  ...items[8],
  result: 'Fail',
  comment: 'Not fitted on this vehicle.',
}

const check: VehicleCheck = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  createdAt: '2026-08-14T07:12:00.000Z',
  updatedAt: '2026-08-14T09:40:00.000Z',
  vehicleId: 'vehicle-1',
  vehicleRegistration: 'YX24 DVR',
  fleetNumber: 'FL-104',
  vehicleMake: 'DAF',
  vehicleModel: 'XF 480',
  vehicleType: 'Artic',
  vehicleStatus: 'Active',
  workerId: 'worker-1',
  workerName: 'James Carter',
  inspectionDate: '2026-08-14',
  odometer: 184250,
  odometerUnit: 'miles',
  status: 'Completed',
  overallResult: 'Advisory',
  notes: 'Walkaround completed before departure to Immingham. Two defects recorded.',
  signatureUrl: 'fixture/signature.png',
  signedAt: '2026-08-14T07:28:00.000Z',
  inspectionStartedAt: '2026-08-14T07:04:00.000Z',
  inspectionCompletedAt: '2026-08-14T07:28:00.000Z',
  durationSeconds: 1440,
  defectCount: 2,
  defectReviewStatus: 'awaiting_review',
  defectReviewedAt: null,
  defectReviewedBy: null,
  defectReviewedByName: null,
  defectReviewNotes: null,
  originalCheckId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  correctionReason: 'Odometer was entered incorrectly on the original check.',
  correctionCreatedBy: 'office-1',
  correctionCreatedAt: '2026-08-14T09:40:00.000Z',
  linkedCorrectionCount: 0,
  latestCorrectionId: null,
  trailerSource: 'company',
  trailerVehicleId: 'trailer-1',
  vehicleRegistrationSnapshot: 'YX24 DVR',
  vehicleFleetNumberSnapshot: 'FL-104',
  trailerNumberSnapshot: 'T-8821',
  trailerRegistrationSnapshot: 'C123456',
  trailerTypeSnapshot: 'Curtainsider',
  trailerLabelSnapshot: 'Curtainsider T-8821',
  items,
  startedLocation: {
    latitude: 53.4084,
    longitude: -2.9916,
    accuracy: 12,
    locationAt: '2026-08-14T07:04:10.000Z',
  },
  completedLocation: {
    latitude: null,
    longitude: null,
    accuracy: null,
    locationAt: null,
  },
}

const photoSizeA = await measurePdfImageSize(samplePhotoA)
const photoSizeB = await measurePdfImageSize(samplePhotoB)
const signatureSize = await measurePdfImageSize(sampleSignature)
const exportMeta = {
  companyName: 'Northgate Logistics Ltd',
  logoUrl: null,
  generatedBy: null,
  generatedAtLabel: formatExportGeneratedAt(new Date('2026-08-15T00:12:00')),
  filterSummary: null,
  documentTitle: 'Vehicle Check',
} as const

const doc = renderVehicleCheckPdfDocument(check, exportMeta, {
  logoDataUrl,
  photos: [
    {
      caption: 'Vehicle — Windscreen wipers and washers',
      dataUrl: samplePhotoA,
      naturalWidth: photoSizeA.width,
      naturalHeight: photoSizeA.height,
    },
    {
      caption: 'Vehicle — Lights and indicators',
      dataUrl: samplePhotoB,
      naturalWidth: photoSizeB.width,
      naturalHeight: photoSizeB.height,
    },
  ],
  signature: {
    caption: 'Worker signature',
    dataUrl: sampleSignature,
    naturalWidth: signatureSize.width,
    naturalHeight: signatureSize.height,
  },
})

const pageCount = doc.getNumberOfPages()
const outputPath = join(tmpdir(), 'drevora-vehicle-check-report-sample.pdf')
const bytes = Buffer.from(doc.output('arraybuffer'))
writeFileSync(outputPath, bytes)

const raw = bytes.toString('latin1')
const requiredPhrases = [
  'VEHICLE CHECK REPORT',
  'Generated by DREVORA',
  'Northgate Logistics Ltd',
  'Page 1 of',
  `Page ${pageCount} of ${pageCount}`,
  'Issues requiring attention',
  'Evidence / Photos',
  'Manager review',
  'Worker signature',
  'Corrected record',
  'Unavailable',
  'YX24 DVR',
  'James Carter',
  'T-8821',
  'Washer jet blocked on the passenger side',
  'Offside rear lamp cracked',
  'Awaiting review',
]

for (const phrase of requiredPhrases) {
  assert(raw.includes(phrase), `PDF is missing expected text: ${phrase}`)
}

assert(
  !raw.includes('No defects reported'),
  'Fixture with defects must not show the empty-defect line',
)
assert(
  raw.indexOf('Issues requiring attention') > -1 &&
    raw.indexOf('Issues requiring attention') < raw.indexOf('Inside cab'),
  'Defects must appear on the first page, before the checklist',
)
assert(
  pageCount >= 2 && pageCount <= 3,
  `Expected a compact 2-page report (3 only if photos require it), got ${pageCount} page(s)`,
)
assert(bytes.length > 20_000, `PDF is unexpectedly small (${bytes.length} bytes)`)
assert(
  !raw.includes('No evidence photos attached'),
  'Fixture with photos must not show the empty photo state',
)
assert(
  !raw.includes('No signature captured'),
  'Fixture with a signature must not show the empty signature state',
)
assert(
  raw.includes('Windscreen wipers and washers'),
  'PDF is missing the first evidence photo caption',
)
assert(
  raw.includes('Lights and indicators'),
  'PDF is missing the second evidence photo caption',
)

const emptyDoc = renderVehicleCheckPdfDocument(check, exportMeta, {
  logoDataUrl,
  photos: [
    {
      caption: 'Should be ignored because it reuses the header logo',
      dataUrl: logoDataUrl,
      naturalWidth: 1336,
      naturalHeight: 424,
    },
  ],
  signature: {
    caption: 'Should be ignored because it reuses the header logo',
    dataUrl: logoDataUrl,
    naturalWidth: 1336,
    naturalHeight: 424,
  },
})
const emptyRaw = Buffer.from(emptyDoc.output('arraybuffer')).toString('latin1')
assert(
  emptyRaw.includes('No evidence photos attached'),
  'Missing/invalid evidence photos must show an empty state instead of the DREVORA logo',
)
assert(
  emptyRaw.includes('No signature captured'),
  'Missing/invalid signature must show an empty state instead of the DREVORA logo',
)
assert(
  !emptyRaw.includes('Should be ignored because it reuses the header logo'),
  'Header logo must not be rendered as an evidence photo or signature',
)

console.log(`Wrote ${outputPath}`)
console.log(`Pages: ${pageCount}`)
console.log(`Bytes: ${bytes.length}`)
console.log('Vehicle Check PDF report fixture checks passed.')
