/// Draws a customer's design into a rectangle the way it will be printed: cover-fitted (the image fills
/// the rectangle, cropped, never stretched), then zoomed and moved by the customer's controls.
///
/// Both the 3D viewer (printing onto the model's texture) and the placement guide (what the customer
/// drags around) call this one function, so what they see while placing is exactly what gets printed.
///
/// fit: { zoom (>= 1), panX, panY } with pan running -1..1 across however much of the image is hidden
/// past the edge. Returns { dx, dy, dw, dh, maxX, maxY } (where the image landed) for drag handling.
export function drawDesignFit(ctx, image, rect, fit) {
  const { x: rx, y: ry, w: rw, h: rh } = rect
  const iw = image.naturalWidth || image.width
  const ih = image.naturalHeight || image.height

  const zoom = fit?.zoom ?? 1
  const k = Math.max(rw / iw, rh / ih) * zoom
  const dw = iw * k
  const dh = ih * k
  const maxX = Math.max(0, (dw - rw) / 2)
  const maxY = Math.max(0, (dh - rh) / 2)
  const dx = rx + (rw - dw) / 2 - (fit?.panX ?? 0) * maxX
  const dy = ry + (rh - dh) / 2 - (fit?.panY ?? 0) * maxY

  ctx.save()
  ctx.beginPath()
  ctx.rect(rx, ry, rw, rh)
  ctx.clip()
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, dx, dy, dw, dh)
  ctx.restore()

  return { dx, dy, dw, dh, maxX, maxY }
}
