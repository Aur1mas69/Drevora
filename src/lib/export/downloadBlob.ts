/**
 * Trigger a browser download for a Blob and revoke the object URL immediately after.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    // Revoke on next tick so the browser can start the download.
    window.setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 0)
  }
}
