const fs = require('node:fs/promises')
const path = require('node:path')
const sharp = require('sharp')

const ROOT = path.resolve(__dirname, '..')
const OUTPUT_DIR = path.join(ROOT, 'public', 'icons', 'sliced')
const OUTPUT_SIZE = 512
const ICON_COUNT = 12
const WHITE_THRESHOLD = 248

const SOURCE_CANDIDATES = [
    path.join(ROOT, 'public', 'icons', 'icon-sheet.png'),
    path.join(ROOT, 'public', 'icon-sheet.png'),
]

const ICON_NAMES = [
    'workers.png',
    'vehicles.png',
    'timesheets.png',
    'holidays.png',
    'vehicle-checks.png',
    'tyre-checks.png',
    'driver-reports.png',
    'documents.png',
    'consumables.png',
    'offline-mobile.png',
    'fleet-office-dashboard.png',
    'security-compliance.png',
]

function chooseGrid(width, height) {
    const options = [
        { cols: 4, rows: 3 },
        { cols: 3, rows: 4 },
        { cols: 6, rows: 2 },
        { cols: 2, rows: 6 },
    ]

    return options
        .map((option) => {
            const cellWidth = width / option.cols
            const cellHeight = height / option.rows
            const aspectDelta = Math.abs(cellWidth / cellHeight - 1)
            return { ...option, cellWidth, cellHeight, aspectDelta }
        })
        .sort((a, b) => a.aspectDelta - b.aspectDelta)[0]
}

function isNearWhite(r, g, b, threshold = WHITE_THRESHOLD) {
    return r >= threshold && g >= threshold && b >= threshold
}

function floodClearBackground(data, width, height) {
    const visited = Buffer.alloc(width * height)
    const queue = []

    const enqueue = (x, y) => {
        const index = y * width + x
        if (visited[index]) return
        const offset = index * 4
        if (!isNearWhite(data[offset], data[offset + 1], data[offset + 2])) return
        visited[index] = 1
        queue.push(index)
    }

    for (let x = 0; x < width; x += 1) {
        enqueue(x, 0)
        enqueue(x, height - 1)
    }
    for (let y = 0; y < height; y += 1) {
        enqueue(0, y)
        enqueue(width - 1, y)
    }

    while (queue.length > 0) {
        const index = queue.pop()
        const x = index % width
        const y = Math.floor(index / width)
        const offset = index * 4
        data[offset + 3] = 0

        if (x > 0) enqueue(x - 1, y)
        if (x + 1 < width) enqueue(x + 1, y)
        if (y > 0) enqueue(x, y - 1)
        if (y + 1 < height) enqueue(x, y + 1)
    }
}

async function resolveSourcePath() {
    for (const candidate of SOURCE_CANDIDATES) {
        try {
            await fs.access(candidate)
            return candidate
        } catch {
            // try the next known location
        }
    }

    throw new Error(
        `Icon sheet not found. Expected one of:\n${SOURCE_CANDIDATES.map((item) => `  ${item}`).join('\n')}`,
    )
}

async function sliceCell(sheet, left, top, width, height, outputPath) {
    const { data, info } = await sheet
        .clone()
        .extract({ left, top, width, height })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

    const pixels = Buffer.from(data)
    floodClearBackground(pixels, info.width, info.height)

    await sharp(pixels, {
        raw: {
            width: info.width,
            height: info.height,
            channels: 4,
        },
    })
        .trim({
            background: { r: 0, g: 0, b: 0, alpha: 0 },
            threshold: 8,
        })
        .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toFile(outputPath)
}

async function main() {
    const sourcePath = await resolveSourcePath()
    await fs.mkdir(OUTPUT_DIR, { recursive: true })

    const sheet = sharp(sourcePath)
    const metadata = await sheet.metadata()
    const width = metadata.width
    const height = metadata.height

    if (!width || !height) {
        throw new Error('Could not read icon sheet dimensions.')
    }

    const grid = chooseGrid(width, height)
    if (grid.cols * grid.rows !== ICON_COUNT) {
        throw new Error(`Grid ${grid.cols}x${grid.rows} does not produce ${ICON_COUNT} icons.`)
    }

    const cellWidth = Math.floor(width / grid.cols)
    const cellHeight = Math.floor(height / grid.rows)

    console.log(`Source: ${sourcePath}`)
    console.log(`Sheet: ${width}x${height} (${metadata.hasAlpha ? 'alpha' : 'opaque'})`)
    console.log(`Grid: ${grid.cols} cols x ${grid.rows} rows`)
    console.log(`Cell: ${cellWidth}x${cellHeight}`)
    console.log(`Output: ${OUTPUT_DIR}`)

    for (let index = 0; index < ICON_NAMES.length; index += 1) {
        const col = index % grid.cols
        const row = Math.floor(index / grid.cols)
        const outputPath = path.join(OUTPUT_DIR, ICON_NAMES[index])

        await sliceCell(
            sheet,
            col * cellWidth,
            row * cellHeight,
            cellWidth,
            cellHeight,
            outputPath,
        )

        const outputMeta = await sharp(outputPath).metadata()
        console.log(
            `  ${ICON_NAMES[index]}  ${outputMeta.width}x${outputMeta.height}  ${outputMeta.hasAlpha ? 'transparent' : 'opaque'}`,
        )
    }
}

main().catch((error) => {
    console.error(error.message || error)
    process.exitCode = 1
})
