const DEFAULT_MAX_WIDTH = 1280
const DEFAULT_JPEG_QUALITY = 0.72
const OUTPUT_MIME_TYPE = 'image/jpeg'

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Unable to read the selected photo.'))
    }

    image.src = objectUrl
  })
}

function buildCompressedFileName(fileName: string): string {
  const baseName = fileName.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || 'defect-photo'
  const sanitized = baseName.replace(/[^\w.\-() ]+/g, '-').replace(/-+/g, '-').slice(0, 80)
  return `${sanitized || 'defect-photo'}.jpg`
}

export async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files can be attached.')
  }

  const image = await loadImageFromFile(file)
  const scale = Math.min(1, DEFAULT_MAX_WIDTH / Math.max(image.width, 1))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Unable to prepare the photo for upload.')
  }

  context.drawImage(image, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, OUTPUT_MIME_TYPE, DEFAULT_JPEG_QUALITY)
  })

  if (!blob) {
    throw new Error('Unable to compress the selected photo.')
  }

  return new File([blob], buildCompressedFileName(file.name), {
    type: OUTPUT_MIME_TYPE,
    lastModified: Date.now(),
  })
}
