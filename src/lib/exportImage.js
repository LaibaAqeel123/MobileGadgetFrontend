// Same brand mark the 2D generator burns into its images (see the server-side renderers).
// TODO: make this an admin-configurable brand name, same as the two server-side copies.
const WATERMARK_TEXT = 'MOBILE GADGETS'

/// Draws the brand mark in the bottom-left corner of a rendered PNG and returns the new PNG blob.
/// Sized relative to the image, so it looks the same on any output resolution.
export async function withWatermark(blob) {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const g = canvas.getContext('2d')
  g.drawImage(bitmap, 0, 0)
  bitmap.close()

  const size = Math.round(canvas.width * 0.02)
  const margin = Math.round(canvas.width * 0.03)
  g.font = `${size}px system-ui, "Segoe UI", Roboto, sans-serif`
  g.fillStyle = 'rgba(255,255,255,0.78)'
  g.textBaseline = 'alphabetic'
  g.fillText(WATERMARK_TEXT, margin, canvas.height - margin)

  return new Promise((resolve, reject) => {
    canvas.toBlob((out) => (out ? resolve(out) : reject(new Error('Could not create the image'))), 'image/png')
  })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function fileSafeName(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'case'
}
