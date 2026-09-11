import { useEffect, useRef, useState } from 'react'

/// Admin-editable camera-area outline, drawn directly over the tilted photo at its own pixel
/// scale (an SVG viewBox matching the photo's natural size, so stored point coordinates are real
/// photo pixels -- exactly what the backend's bake-camera-mask endpoint expects, no conversion).
///
/// Three tools:
///  - "outline" (default): drag a point to move it, click a point to remove it, click empty space
///    to insert a new point at the nearest edge. This is the main shape -- it should trace the
///    real camera module boundary.
///  - "protect": click to drop a small circle that must NEVER get the design, even if the outline
///    covers it (a stray hole the outline missed, or a logo). Click an existing one to remove it.
///  - "allow": click to drop a small circle that SHOULD get the design even though it falls inside
///    the outline (part of the real case body the outline wrongly swallowed). Click to remove.
///
/// The smooth curve drawn through the outline points is a client-side Catmull-Rom-to-Bezier
/// conversion for a live visual guide only -- the actual mask is always baked server-side (same
/// math family, Geometry2D.CatmullRomClosed) via bakeCameraMask, which is what customers ever see.
export default function CameraOutlineEditor({ imageUrl, outline, spots, onOutlineChange, onSpotsChange, mode }) {
  const svgRef = useRef(null)
  const [naturalSize, setNaturalSize] = useState(null)
  const dragRef = useRef(null) // { kind: 'point'|'spot', index, moved, startX, startY }

  useEffect(() => {
    if (!imageUrl) return
    setNaturalSize(null)
    const img = new Image()
    img.onload = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = imageUrl
  }, [imageUrl])

  if (!naturalSize) {
    return <div className="text-xs text-zinc-400 py-8 text-center">Loading photo...</div>
  }

  const maxDim = Math.max(naturalSize.w, naturalSize.h)
  const handleR = maxDim * 0.01
  const hitR = maxDim * 0.018
  const defaultSpotR = maxDim * 0.035

  function toSvgPoint(evt) {
    const svg = svgRef.current
    const pt = svg.createSVGPoint()
    pt.x = evt.clientX
    pt.y = evt.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return { X: 0, Y: 0 }
    const p = pt.matrixTransform(ctm.inverse())
    return { X: p.x, Y: p.y }
  }

  function dist2(a, b) {
    const dx = a.X - b.X
    const dy = a.Y - b.Y
    return dx * dx + dy * dy
  }

  function nearestEdgeInsertIndex(p) {
    let bestIdx = 0
    let bestD = Infinity
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i]
      const b = outline[(i + 1) % outline.length]
      const abx = b.X - a.X
      const aby = b.Y - a.Y
      const len2 = abx * abx + aby * aby || 1
      let t = ((p.X - a.X) * abx + (p.Y - a.Y) * aby) / len2
      t = Math.max(0, Math.min(1, t))
      const proj = { X: a.X + abx * t, Y: a.Y + aby * t }
      const d = dist2(p, proj)
      if (d < bestD) {
        bestD = d
        bestIdx = i + 1
      }
    }
    return bestIdx
  }

  function handleBackgroundPointerDown(evt) {
    if (evt.target !== svgRef.current) return // a handle's own pointerdown already ran
    const p = toSvgPoint(evt)
    if (mode === 'outline') {
      const insertAt = nearestEdgeInsertIndex(p)
      const next = [...outline]
      next.splice(insertAt, 0, p)
      onOutlineChange(next)
    } else {
      const protect = mode === 'protect'
      onSpotsChange([...spots, { X: p.X, Y: p.Y, Radius: defaultSpotR, Protect: protect }])
    }
  }

  function startDragPoint(evt, index) {
    evt.stopPropagation()
    evt.currentTarget.setPointerCapture(evt.pointerId)
    dragRef.current = { kind: 'point', index, moved: false }
  }

  function startDragSpot(evt, index) {
    evt.stopPropagation()
    evt.currentTarget.setPointerCapture(evt.pointerId)
    dragRef.current = { kind: 'spot', index, moved: false }
  }

  function handlePointerMove(evt) {
    const d = dragRef.current
    if (!d) return
    d.moved = true
    const p = toSvgPoint(evt)
    if (d.kind === 'point') {
      const next = [...outline]
      next[d.index] = p
      onOutlineChange(next)
    } else {
      const next = [...spots]
      next[d.index] = { ...next[d.index], X: p.X, Y: p.Y }
      onSpotsChange(next)
    }
  }

  function handlePointerUp() {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    if (!d.moved) {
      // A plain click on the handle itself -- remove it.
      if (d.kind === 'point') {
        if (outline.length > 4) onOutlineChange(outline.filter((_, i) => i !== d.index))
      } else {
        onSpotsChange(spots.filter((_, i) => i !== d.index))
      }
    }
  }

  const curvePath = catmullRomClosedPath(outline)

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${naturalSize.w} ${naturalSize.h}`}
      className="w-full h-full block touch-none select-none"
      style={{ cursor: mode === 'outline' ? 'crosshair' : 'copy' }}
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <image href={imageUrl} x="0" y="0" width={naturalSize.w} height={naturalSize.h} preserveAspectRatio="xMidYMid meet" />

      <path d={curvePath} fill="rgba(99,102,241,0.18)" stroke="#6366f1" strokeWidth={maxDim * 0.0025} />

      {outline.map((p, i) => (
        <circle
          key={i}
          cx={p.X}
          cy={p.Y}
          r={handleR}
          fill="#fff"
          stroke="#4f46e5"
          strokeWidth={maxDim * 0.002}
          onPointerDown={(e) => startDragPoint(e, i)}
          onPointerUp={handlePointerUp}
        />
      ))}

      {spots.map((s, i) => (
        <circle
          key={i}
          cx={s.X}
          cy={s.Y}
          r={s.Radius}
          fill={s.Protect ? 'rgba(220,38,38,0.35)' : 'rgba(16,185,129,0.35)'}
          stroke={s.Protect ? '#dc2626' : '#10b981'}
          strokeWidth={maxDim * 0.0025}
          onPointerDown={(e) => startDragSpot(e, i)}
          onPointerUp={handlePointerUp}
        />
      ))}
    </svg>
  )
}

/// Closed Catmull-Rom (uniform) converted to an SVG cubic-bezier path -- a live visual guide only.
function catmullRomClosedPath(points) {
  const n = points.length
  if (n < 3) return ''
  const at = (i) => points[((i % n) + n) % n]
  let d = `M ${at(0).X} ${at(0).Y} `
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const c1x = p1.X + (p2.X - p0.X) / 6
    const c1y = p1.Y + (p2.Y - p0.Y) / 6
    const c2x = p2.X - (p3.X - p1.X) / 6
    const c2y = p2.Y - (p3.Y - p1.Y) / 6
    d += `C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.X} ${p2.Y} `
  }
  return d + 'Z'
}
