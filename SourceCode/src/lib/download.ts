/**
 * Browser helpers for saving files: text, blobs, and SVG rendered to PNG.
 */

/**
 * Saves a blob as a file through a temporary link.
 *
 * @param name - File name.
 * @param blob - Contents.
 */
export function saveBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke after the click has been handled.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Saves text as a UTF-8 file.
 *
 * @param name - File name.
 * @param text - Contents.
 * @param type - MIME type.
 */
export function saveText(name: string, text: string, type = 'text/plain'): void {
  saveBlob(name, new Blob([text], { type: `${type};charset=utf-8` }))
}

/**
 * Renders an SVG document to a PNG.
 *
 * @param svg - SVG text with explicit width and height.
 * @param width - Width in CSS pixels.
 * @param height - Height in CSS pixels.
 * @param scale - Pixel ratio (2 gives a sharp image on slides and in print).
 * @returns The PNG as a blob.
 * @throws If the browser cannot draw the image.
 */
export async function svgToPng(svg: string, width: number, height: number, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('The diagram could not be drawn.'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(width * scale)
    canvas.height = Math.ceil(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available.')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, width, height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed.'))), 'image/png'),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Reads a blob as a data URL (for embedding images in a PDF).
 *
 * @param blob - The blob.
 * @returns `data:` URL.
 */
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}
