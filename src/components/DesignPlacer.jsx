import { useEffect, useMemo, useRef } from 'react'
import { drawDesignFit } from '../lib/designFit'

/// A flat picture of the case's printable surface that the customer drags their design around in.
///
/// It shows the design exactly as it will be printed (same drawing code as the 3D view), with the
/// parts of the case that cannot be printed darkened -- the camera window, the button openings and
/// the empty corners -- and the strip that wraps around the sides tinted blue. All of that is read
/// from the 3D model itself (see buildPrintGuide in Model3DViewer), not typed in by an admin.
///
/// props:
///   image         the design (HTMLImageElement)
///   guide         { width, height, printable, back } canvases from the viewer
///   fit           { zoom, panX, panY }
///   onFitChange   called with a new fit while the customer drags
export default function DesignPlacer({ image, guide, fit, onFitChange, className = '' }) {
  const canvasRef = useRef(null)
  const placed = useRef(null) // where the design last landed, for turning a drag into a pan
  const drag = useRef(null)

  // Dark where nothing prints; blue where the design wraps round the sides. Built once per model.
  const overlay = useMemo(() => {
    if (!guide) return null
    const { width: W, height: H } = guide
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d')

    g.fillStyle = 'rgba(24,24,27,0.74)'
    g.fillRect(0, 0, W, H)
    g.globalCompositeOperation = 'destination-out'
    g.drawImage(guide.printable, 0, 0)

    const side = document.createElement('canvas')
    side.width = W
    side.height = H
    const sg = side.getContext('2d')
    sg.drawImage(guide.printable, 0, 0)
    sg.globalCompositeOperation = 'destination-out'
    sg.drawImage(guide.back, 0, 0)
    sg.globalCompositeOperation = 'source-in'
    sg.fillStyle = 'rgba(79,70,229,0.34)'
    sg.fillRect(0, 0, W, H)

    g.globalCompositeOperation = 'source-over'
    g.drawImage(side, 0, 0)
    return c
  }, [guide])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !guide || !image) return
    const g = canvas.getContext('2d')
    g.clearRect(0, 0, guide.width, guide.height)
    placed.current = drawDesignFit(g, image, { x: 0, y: 0, w: guide.width, h: guide.height }, fit)
    if (overlay) g.drawImage(overlay, 0, 0)
  }, [image, guide, fit, overlay])

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, panX: fit.panX, panY: fit.panY }
  }

  function onPointerMove(e) {
    if (!drag.current || !placed.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    // screen pixels -> canvas pixels
    const dx = ((e.clientX - drag.current.x) * guide.width) / rect.width
    const dy = ((e.clientY - drag.current.y) * guide.height) / rect.height
    const { maxX, maxY } = placed.current
    // dragging the picture right moves it right, which is a smaller pan value (see drawDesignFit)
    const clamp = (v) => Math.max(-1, Math.min(1, v))
    onFitChange({
      ...fit,
      panX: maxX > 0 ? clamp(drag.current.panX - dx / maxX) : 0,
      panY: maxY > 0 ? clamp(drag.current.panY - dy / maxY) : 0,
    })
  }

  function onPointerUp() {
    drag.current = null
  }

  if (!guide || !image) return null
  return (
    <canvas
      ref={canvasRef}
      width={guide.width}
      height={guide.height}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label="Drag to position your design on the case"
      className={`rounded-lg border border-zinc-300 bg-zinc-100 cursor-grab active:cursor-grabbing select-none ${className}`}
      style={{ touchAction: 'none', aspectRatio: `${guide.width} / ${guide.height}` }}
    />
  )
}
