import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Box, Check, Download, ImageOff, Loader2, Search } from 'lucide-react'
import { listHeroModels, POSE_MODEL3D } from '../api/heroModels'
import { listScenes } from '../api/scenes'
import { resolveImageUrl } from '../api/client'
import { downloadBlob, fileSafeName, withWatermark } from '../lib/exportImage'
import { VIEW_NAMES } from '../lib/viewPresets'
import DesignDropzone from '../components/DesignDropzone'
import Model3DViewer from '../components/Model3DViewer'
import Button from '../components/Button'

// Plain studio colours that are always available, whatever the admin has set up.
const STUDIO_COLORS = [
  { id: 'color:#c9ccd3', label: 'Studio grey', value: '#c9ccd3' },
  { id: 'color:#e9e2d8', label: 'Warm cream', value: '#e9e2d8' },
  { id: 'color:#e8d3d6', label: 'Soft blush', value: '#e8d3d6' },
  { id: 'color:#bcd0e6', label: 'Cool blue', value: '#bcd0e6' },
  { id: 'color:#2b2e36', label: 'Dark', value: '#2b2e36' },
]

// The design is printed into a texture this many pixels across (see Model3DViewer), so this is the
// size an image has to be to print at full sharpness.
const TEXTURE_SIZE = 2048

function StepLabel({ n, children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-5 h-5 rounded-full bg-zinc-900 text-white text-xs font-medium flex items-center justify-center shrink-0">
        {n}
      </span>
      <h2 className="text-sm font-medium text-zinc-900">{children}</h2>
    </div>
  )
}

function parseLayout(json) {
  try {
    return json ? JSON.parse(json) : null
  } catch {
    return null
  }
}

function Slider({ label, value, min, max, step, onChange }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-indigo-600"
      />
    </label>
  )
}

export default function HeroGenerator3D() {
  const [models, setModels] = useState([])
  const [scenes, setScenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [designFile, setDesignFile] = useState(null)
  const [loadedDesign, setLoadedDesign] = useState(null)
  const [designFit, setDesignFit] = useState({ zoom: 1, panX: 0, panY: 0 })
  const [backdropId, setBackdropId] = useState(STUDIO_COLORS[0].id)
  const [bgTab, setBgTab] = useState('presets') // 'presets' | 'upload'
  const [bgFile, setBgFile] = useState(null)
  const [bgUrl, setBgUrl] = useState(null)
  const bgUrlRef = useRef(null)
  const [viewRequest, setViewRequest] = useState({ name: 'back', n: 0 })
  const [readyModelId, setReadyModelId] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const viewerRef = useRef(null)

  useEffect(() => {
    Promise.all([listHeroModels(), listScenes()])
      .then(([modelsData, scenesData]) => {
        setModels(modelsData.filter((m) => m.poseType === POSE_MODEL3D))
        setScenes(scenesData)
      })
      .catch(() => setError('Failed to load phone models.'))
      .finally(() => setLoading(false))
  }, [])

  const selectedModel = models.find((m) => m.id === selectedId)
  const designImage = designFile ? loadedDesign : null
  const modelReady = selectedId !== null && readyModelId === selectedId
  const layout = useMemo(() => parseLayout(selectedModel?.printLayoutJson), [selectedModel?.printLayoutJson])

  // turn the chosen file into an image the viewer can draw, and start its placement from scratch
  useEffect(() => {
    if (!designFile) return
    const url = URL.createObjectURL(designFile)
    const img = new Image()
    img.onload = () => {
      setLoadedDesign(img)
      setDesignFit({ zoom: 1, panX: 0, panY: 0 })
    }
    img.onerror = () => setError('That file could not be read as an image.')
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [designFile])

  const filteredModels = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? models.filter((m) => `${m.phoneName} ${m.caseType}`.toLowerCase().includes(q)) : models
  }, [models, query])

  const photoScenes = scenes // every background the admin has set up: photos and colour gradients
  const backdrop = useMemo(() => {
    if (backdropId === 'upload') return bgUrl ? { imageUrl: bgUrl } : STUDIO_COLORS[0].value
    if (backdropId.startsWith('color:')) return backdropId.slice(6)
    const scene = scenes.find((s) => `scene:${s.id}` === backdropId)
    if (!scene) return STUDIO_COLORS[0].value
    return scene.backgroundImageUrl
      ? { imageUrl: resolveImageUrl(scene.backgroundImageUrl) }
      : { top: scene.backgroundTopColor, bottom: scene.backgroundBottomColor }
  }, [backdropId, bgUrl, scenes])

  // How much the design must be enlarged to fill the printable area: above ~1.5x it starts to look soft.
  const sharpness = useMemo(() => {
    if (!designImage || !layout) return null
    const rw = (layout.u1 - layout.u0) * TEXTURE_SIZE
    const rh = (layout.v1 - layout.v0) * TEXTURE_SIZE
    const needed = Math.max(rw / designImage.naturalWidth, rh / designImage.naturalHeight) * designFit.zoom
    return { soft: needed > 1.5, width: Math.round(rw), height: Math.round(rh) }
  }, [designImage, layout, designFit.zoom])

  function chooseUpload(file) {
    if (bgUrlRef.current) URL.revokeObjectURL(bgUrlRef.current)
    bgUrlRef.current = file ? URL.createObjectURL(file) : null
    setBgUrl(bgUrlRef.current)
    setBgFile(file)
    setBackdropId(file ? 'upload' : STUDIO_COLORS[0].id)
  }

  async function handleDownload() {
    if (!viewerRef.current || !designImage) return
    setDownloading(true)
    setError('')
    try {
      const raw = await viewerRef.current.capture(2048)
      const withMark = await withWatermark(raw)
      downloadBlob(withMark, `${fileSafeName(selectedModel.phoneName)}-case.png`)
    } catch {
      setError('Could not create the image. Try again.')
    } finally {
      setDownloading(false)
    }
  }

  const canDownload = Boolean(selectedModel && designImage && modelReady && !downloading)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-900">3D Case Generator</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Pick a phone, upload your design, and see it printed on a real 3D case from any angle. Download the picture to share.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* the 3D view: first on a phone-sized screen, beside the steps on a wide one */}
        <div className="lg:col-start-2 lg:row-start-1 lg:sticky lg:top-20 self-start flex flex-col gap-3">
          <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100 shadow-sm">
            {selectedModel ? (
              <>
                <Model3DViewer
                  key={selectedModel.id}
                  ref={viewerRef}
                  className="absolute inset-0"
                  glbUrl={resolveImageUrl(selectedModel.glbUrl)}
                  printMaterialName={selectedModel.printMaterialName}
                  layout={layout}
                  designImage={designImage}
                  designFit={designFit}
                  viewRequest={viewRequest}
                  backdrop={backdrop}
                  onLoad={() => setReadyModelId(selectedModel.id)}
                  onError={() => setError('The 3D model or background could not be loaded.')}
                />
                {!modelReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-100/80 text-zinc-500 text-sm gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading 3D model...
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-400">
                <Box className="w-8 h-8" />
                <p className="text-sm">Choose a phone to see it here</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {VIEW_NAMES.map((v) => (
              <button
                key={v.id}
                onClick={() => setViewRequest((r) => ({ name: v.id, n: r.n + 1 }))}
                disabled={!selectedModel}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
              >
                {v.label}
              </button>
            ))}
            <span className="text-xs text-zinc-400 ml-1">or drag the phone to turn it</span>
          </div>

          <Button onClick={handleDownload} disabled={!canDownload} loading={downloading} className="w-full py-3">
            <Download className="w-4 h-4" /> {downloading ? 'Creating your image...' : 'Download image'}
          </Button>
          {selectedModel && !designImage && <p className="text-xs text-zinc-400 -mt-1">Upload a design to enable the download.</p>}
        </div>

        {/* the steps */}
        <div className="lg:col-start-1 lg:row-start-1">
          <div className="mb-8">
            <StepLabel n={1}>Choose a phone</StepLabel>
            {loading ? (
              <div className="flex items-center gap-2 text-zinc-400 text-sm py-6">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading models...
              </div>
            ) : models.length === 0 ? (
              <div className="flex flex-col items-center gap-2 text-zinc-400 py-10 border border-dashed border-zinc-200 rounded-xl">
                <ImageOff className="w-5 h-5" />
                <p className="text-sm">No 3D phone models yet — an admin needs to add one first.</p>
              </div>
            ) : (
              <>
                <div className="relative mb-3">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by phone or case type..."
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                {filteredModels.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 text-zinc-400 py-10 border border-dashed border-zinc-200 rounded-xl">
                    <Search className="w-5 h-5" />
                    <p className="text-sm">No phone models match "{query}".</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {filteredModels.map((m) => {
                      const selected = m.id === selectedId
                      return (
                        <button
                          key={m.id}
                          onClick={() => setSelectedId(m.id)}
                          className={`relative text-left rounded-xl border p-3 flex items-center gap-3 transition-all ${
                            selected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-zinc-200 hover:border-zinc-300'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <Box className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-zinc-900 truncate">{m.phoneName}</div>
                            <div className="text-xs text-zinc-500 truncate">{m.caseType}</div>
                          </div>
                          {selected && (
                            <div className="absolute top-2 right-2 bg-indigo-600 rounded-full p-0.5">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mb-8">
            <StepLabel n={2}>Upload your design</StepLabel>
            <DesignDropzone file={designFile} onChange={setDesignFile} />
            {sharpness?.soft && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 text-amber-900 px-3 py-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                <p>
                  This image is small for this case and may print soft. For the sharpest result use a picture at least about{' '}
                  {sharpness.width} × {sharpness.height} pixels.
                </p>
              </div>
            )}
            {designImage && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border border-zinc-200 p-3">
                <Slider label="Zoom" value={designFit.zoom} min={1} max={3} step={0.01} onChange={(zoom) => setDesignFit((f) => ({ ...f, zoom }))} />
                <Slider label="Move left / right" value={designFit.panX} min={-1} max={1} step={0.01} onChange={(panX) => setDesignFit((f) => ({ ...f, panX }))} />
                <Slider label="Move up / down" value={designFit.panY} min={-1} max={1} step={0.01} onChange={(panY) => setDesignFit((f) => ({ ...f, panY }))} />
                <p className="sm:col-span-3 text-xs text-zinc-400">
                  Your design wraps around the edges too. The camera and buttons stay clear automatically.
                </p>
              </div>
            )}
          </div>

          <div className="mb-8">
            <StepLabel n={3}>Choose a background</StepLabel>
            <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 mb-3 bg-zinc-50">
              {[
                ['presets', 'Presets'],
                ['upload', 'Upload your own'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setBgTab(id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    bgTab === id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {bgTab === 'presets' ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {STUDIO_COLORS.map((c) => (
                  <BackdropTile key={c.id} selected={backdropId === c.id} label={c.label} onClick={() => setBackdropId(c.id)}>
                    <div className="h-12" style={{ background: c.value }} />
                  </BackdropTile>
                ))}
                {photoScenes.map((s) => {
                  const id = `scene:${s.id}`
                  return (
                    <BackdropTile key={id} selected={backdropId === id} label={s.name} onClick={() => setBackdropId(id)}>
                      {s.backgroundImageUrl ? (
                        <img src={resolveImageUrl(s.backgroundImageUrl)} alt="" className="h-12 w-full object-cover" />
                      ) : (
                        <div className="h-12" style={{ background: `linear-gradient(to bottom, ${s.backgroundTopColor}, ${s.backgroundBottomColor})` }} />
                      )}
                    </BackdropTile>
                  )
                })}
              </div>
            ) : (
              <DesignDropzone
                file={bgFile}
                onChange={chooseUpload}
                label="Click or drag a background photo here"
                hint="PNG, JPG, or WebP — we fit it to the frame"
                previewAlt="Your background"
              />
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  )
}

function BackdropTile({ selected, label, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`relative text-left rounded-xl border overflow-hidden transition-all ${
        selected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-zinc-200 hover:border-zinc-300'
      }`}
    >
      {children}
      <div className="px-2 py-1.5 bg-white">
        <div className="text-xs text-zinc-700 truncate">{label}</div>
      </div>
      {selected && (
        <div className="absolute top-1.5 right-1.5 bg-indigo-600 rounded-full p-0.5">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
  )
}
