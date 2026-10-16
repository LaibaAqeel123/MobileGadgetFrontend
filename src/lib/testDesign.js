// A pattern made to expose problems on a printable surface: a coloured gradient, a frame and
// lines that run into every edge, circles that must stay round, and text near each side. Used by the
// admin preview so a new 3D model can be judged (stretching, seams, cut-off edges) without needing a
// real customer design.
export function makeTestDesignImage() {
  const c = document.createElement('canvas')
  c.width = 1400
  c.height = 2560
  const g = c.getContext('2d')

  const grad = g.createLinearGradient(0, 0, c.width, c.height)
  grad.addColorStop(0, '#ff5f6d')
  grad.addColorStop(1, '#ffc371')
  g.fillStyle = grad
  g.fillRect(0, 0, c.width, c.height)

  g.strokeStyle = '#111'
  g.lineWidth = 24
  g.strokeRect(12, 12, c.width - 24, c.height - 24)

  g.strokeStyle = '#fff'
  g.lineWidth = 8
  for (let i = 1; i < 14; i++) {
    g.beginPath()
    g.moveTo(0, (i * c.height) / 14)
    g.lineTo(c.width, (i * c.height) / 14)
    g.stroke()
  }
  for (let i = 1; i < 8; i++) {
    g.beginPath()
    g.moveTo((i * c.width) / 8, 0)
    g.lineTo((i * c.width) / 8, c.height)
    g.stroke()
  }

  g.fillStyle = '#111'
  for (const [x, y] of [[90, 90], [c.width - 90, 90], [90, c.height - 90], [c.width - 90, c.height - 90]]) {
    g.beginPath()
    g.arc(x, y, 60, 0, Math.PI * 2)
    g.fill()
  }
  g.beginPath()
  g.arc(c.width / 2, c.height / 2, 330, 0, Math.PI * 2)
  g.lineWidth = 20
  g.stroke()

  g.font = 'bold 120px sans-serif'
  g.textAlign = 'center'
  g.fillStyle = '#111'
  g.fillText('TOP EDGE', c.width / 2, 170)
  g.fillText('BOTTOM EDGE', c.width / 2, c.height - 120)
  g.fillText('CIRCLE = ROUND', c.width / 2, c.height / 2 + 20)
  g.save()
  g.translate(120, c.height / 2)
  g.rotate(-Math.PI / 2)
  g.fillText('LEFT EDGE', 0, 0)
  g.restore()
  g.save()
  g.translate(c.width - 100, c.height / 2)
  g.rotate(Math.PI / 2)
  g.fillText('RIGHT EDGE', 0, 0)
  g.restore()

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = c.toDataURL('image/png')
  })
}

// A calm pastel design used only for the little list thumbnail of a 3D model, so the thumbnail shows
// the phone and case rather than the loud test pattern.
export function makeThumbnailDesignImage() {
  const c = document.createElement('canvas')
  c.width = 700
  c.height = 1280
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, c.width, c.height)
  grad.addColorStop(0, '#a5b4fc')
  grad.addColorStop(0.55, '#c4b5fd')
  grad.addColorStop(1, '#fbcfe8')
  g.fillStyle = grad
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = 'rgba(255,255,255,0.22)'
  g.beginPath()
  g.arc(c.width * 0.8, c.height * 0.72, 330, 0, Math.PI * 2)
  g.fill()
  g.beginPath()
  g.arc(c.width * 0.15, c.height * 0.9, 220, 0, Math.PI * 2)
  g.fill()
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = c.toDataURL('image/png')
  })
}
