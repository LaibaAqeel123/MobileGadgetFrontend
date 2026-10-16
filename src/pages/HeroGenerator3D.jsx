import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Box, Check, Download, Loader2 } from 'lucide-react'
import { listHeroModels, POSE_MODEL3D } from '../api/heroModels'
import { listScenes } from '../api/scenes'
import { saveRenderedHero } from '../api/heroGenerations'
import { resolveImageUrl } from '../api/client'
import { downloadBlob, fileSafeName, withWatermark } from '../lib/exportImage'
import { VIEW_NAMES } from '../lib/viewPresets'
import DesignDropzone from '../components/DesignDropzone'
import DesignPlacer from '../components/DesignPlacer'
import Model3DViewer from '../components/Model3DViewer'
import Button from '../components/Button'

// Plain studio colours that are always available, whatever the admin has set up.
const STUDIO_COLORS = [
  { id: 'color:#c9ccd3', label: 'Grey', value: '#c9ccd3' },
  { id: 'color:#e9e2d8', label: 'Cream', value: '#e9e2d8' },
  { id: 'color:#e8d3d6', label: 'Blush', value: '#e8d3d6' },
  { id: 'color:#bcd0e6', label: 'Blue', value: '#bcd0e6' },
  { id: 'color:#2b2e36', label: 'Dark', value: '#2b2e36' },
]

// The design is printed into a texture this many pixels across (see Model3DViewer), so this is the
// size an image has to be to print at full sharpness.
const TEXTURE_SIZE = 2048

function parseLayout(json) {
  try {
    return json ? JSON.parse(json) : null
  } catch {
    return null
  }
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2.5">{title}</h2>
      {children}
    </section>
  )
}

function Slider({ label, hint, value, min, max, step, onChange }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between text-xs text-zinc-600">
        {label}
        {hint && <span className="text-zinc-400">{hint}</span>}
      </span>
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

function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 bg-zinc-50 mb-3">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            value === id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Swatch({ selected, label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`relative rounded-lg border overflow-hidden text-left transition-all ${
        selected ? 'border-indigo-500 ring-2 ring-indigo-500/25' : 'border-zinc-200 hover:border-zinc-300'
      }`}
    >
      {children}
      <div className="px-1.5 py-1 bg-white text-[11px] text-zinc-600 truncate">{label}</div>
      {selected && (
        <div className="absolute top-1 right-1 bg-indigo-600 rounded-full p-0.5">
          <Check className="w-2.5 h-2.5 text-white" />
        </div>
      )}
    </button>
  )
}

export default function HeroGenerator3D() {
  const [models, setModels] = useState([])
  const [scenes, setScenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [designFile, setDesignFile] = useState(null)
  const [loadedDesign, setLoadedDesign] = useState(null)
  const [designFit, setDesignFit] = useState({ zoom: 1, panX: 0, panY: 0 })
  const [backdropId, setBackdropId] = useState(STUDIO_COLORS[0].id)
  const [bgTab, setBgTab] = useState('presets') // 'presets' | 'upload' | 'colour'
  const [bgFile, setBgFile] = useState(null)
  const [bgUrl, setBgUrl] = useState(null)
  const bgUrlRef = useRef(null)
  const [customColor, setCustomColor] = useState('#d9c7b8')
  const [viewRequest, setViewRequest] = useState({ name: 'back', n: 0 })
  const [autoSpin, setAutoSpin] = useState(false)
  const [roughness, setRoughness] = useState(0.6)
  const [lightStrength, setLightStrength] = useState(1)
  const [trimColor, setTrimColor] = useState('#f1f1f1')
  const [trimTouched, setTrimTouched] = useState(false)
  const [showFrame, setShowFrame] = useState(true)
  const [readyModelId, setReadyModelId] = useState(null)
  const [loadedInfo, setLoadedInfo] = useState(null) // { modelId, guide, hasTrim }
  const [downloading, setDownloading] = useState(false)
  const [saveNote, setSaveNote] = useState('')
  const [error, setError] = useState('')
  const viewerRef = useRef(null)

  useEffect(() => {
    Promise.all([listHeroModels(), listScenes()])
      .then(([modelsData, scenesData]) => {
        const threeD = modelsData.filter((m) => m.poseType === POSE_MODEL3D)
        setModels(threeD)
        setScenes(scenesData)
        if (threeD.length > 0) setSelectedId(threeD[0].id) // show a phone straight away
      })
      .catch(() => setError('Failed to load phone models.'))
      .finally(() => setLoading(false))
  }, [])

  const selectedModel = models.find((m) => m.id === selectedId)
  const layout = useMemo(() => parseLayout(selectedModel?.printLayoutJson), [selectedModel?.printLayoutJson])
  const designImage = designFile ? loadedDesign : null
  const modelReady = selectedId !== null && readyModelId === selectedId
  const guide = loadedInfo?.modelId === selectedId ? loadedInfo.guide : null
  const hasTrim = loadedInfo?.modelId === selectedId ? loadedInfo.hasTrim : false
  // the model's own material (leather, gloss, metal...) is shown as made, so the finish slider is not offered
  const ownLook = loadedInfo?.modelId === selectedId && loadedInfo.look === 'file'

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

  const backdrop = useMemo(() => {
    if (backdropId === 'upload') return bgUrl ? { imageUrl: bgUrl } : STUDIO_COLORS[0].value
    if (backdropId === 'custom') return customColor
    if (backdropId.startsWith('color:')) return backdropId.slice(6)
    const scene = scenes.find((s) => `scene:${s.id}` === backdropId)
    if (!scene) return STUDIO_COLORS[0].value
    return scene.backgroundImageUrl
      ? { imageUrl: resolveImageUrl(scene.backgroundImageUrl) }
      : { top: scene.backgroundTopColor, bottom: scene.backgroundBottomColor }
  }, [backdropId, bgUrl, customColor, scenes])

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
    setSaveNote('')
    let picture
    try {
      const raw = await viewerRef.current.capture(2048)
      picture = await withWatermark(raw)
      downloadBlob(picture, `${fileSafeName(selectedModel.phoneName)}-case.png`)
    } catch {
      setError('Could not create the image. Try again.')
      setDownloading(false)
      return
    }

    // The customer already has their picture. Keeping a copy on the server is a bonus: if it fails
    // they still got what they came for, so it only ever adds a note, never an error.
    try {
      const saved = await saveRenderedHero({
        heroModelId: selectedModel.id,
        designFile,
        outputBlob: picture,
        sceneId: backdropId.startsWith('scene:') ? Number(backdropId.slice(6)) : null,
        backgroundFile: backdropId === 'upload' ? bgFile : null,
      })
      setSaveNote(`A copy is saved online: ${resolveImageUrl(saved.outputImageUrl)}`)
    } catch {
      setSaveNote('Your picture was downloaded. We could not keep an online copy this time.')
    } finally {
      setDownloading(false)
    }
  }

  const canDownload = Boolean(selectedModel && designImage && modelReady && !downloading)

  return (
    // The page fills the screen under the top bar: the 3D view takes the room, only the options
    // panel scrolls. On a phone the view sits on top and the panel below it.
    <div className="flex flex-col lg:flex-row h-[calc(100dvh-3.5rem-1px)] overflow-hidden">
      {/* ---------------- the 3D view ---------------- */}
      <div className="relative flex-none h-[50dvh] lg:h-auto lg:flex-1 min-h-0 bg-zinc-100">
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
              roughness={roughness}
              lightStrength={lightStrength}
              autoSpin={autoSpin}
              trimColor={hasTrim && trimTouched ? trimColor : null}
              onLoad={({ guide: g, hasTrim: trim, look }) => {
                setReadyModelId(selectedModel.id)
                setLoadedInfo({ modelId: selectedModel.id, guide: g, hasTrim: trim, look })
              }}
              onError={() => setError('The 3D model or background could not be loaded.')}
            />
            {/* what the downloaded square picture covers on a wide screen */}
            {showFrame && (
              <div className="hidden lg:block absolute inset-y-3 left-1/2 -translate-x-1/2 aspect-square pointer-events-none rounded-md border border-dashed border-zinc-500/40" />
            )}
            {!modelReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-100/80 text-zinc-500 text-sm gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading 3D model...
              </div>
            )}
            <div className="absolute left-3 top-3 rounded-md bg-white/80 backdrop-blur px-2.5 py-1 text-xs font-medium text-zinc-700">
              {selectedModel.phoneName} · {selectedModel.caseType}
            </div>
            <div className="absolute left-0 right-0 bottom-2 text-center text-[11px] text-zinc-500 pointer-events-none">
              Drag to turn · scroll to zoom
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-400 px-6 text-center">
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Box className="w-9 h-9" />}
            <p className="text-sm">
              {loading ? 'Loading...' : 'No 3D phone models yet — an admin needs to add one under "Add Model".'}
            </p>
          </div>
        )}
      </div>

      {/* ---------------- the options ---------------- */}
      <aside className="flex-1 lg:flex-none lg:w-[380px] min-h-0 flex flex-col bg-white border-t lg:border-t-0 lg:border-l border-zinc-200">
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
          <Section title="Phone">
            {models.length === 0 ? (
              <p className="text-sm text-zinc-400">{loading ? 'Loading...' : 'None yet.'}</p>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 overflow-hidden">
                  {selectedModel?.baseImageUrl ? (
                    <img src={resolveImageUrl(selectedModel.baseImageUrl)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Box className="w-5 h-5" />
                  )}
                </div>
                <select
                  value={selectedId ?? ''}
                  onChange={(e) => setSelectedId(Number(e.target.value))}
                  className="flex-1 min-w-0 border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.phoneName} — {m.caseType}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </Section>

          <Section title="Your design">
            <DesignDropzone compact file={designFile} onChange={setDesignFile} label="Click or drag your design" hint="PNG, JPG or WebP" />
            {sharpness?.soft && (
              <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-amber-50 text-amber-900 px-3 py-2 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                <p>
                  Small for this case — it may print soft. Aim for about {sharpness.width} × {sharpness.height} pixels.
                </p>
              </div>
            )}
            {designImage && (
              <div className="mt-3 flex gap-3">
                {guide && <DesignPlacer image={designImage} guide={guide} fit={designFit} onFitChange={setDesignFit} className="w-24 shrink-0 self-start" />}
                <div className="flex-1 min-w-0 flex flex-col gap-2.5">
                  <Slider label="Zoom" value={designFit.zoom} min={1} max={3} step={0.01} onChange={(zoom) => setDesignFit((f) => ({ ...f, zoom }))} />
                  {!guide && (
                    <>
                      <Slider label="Left / right" value={designFit.panX} min={-1} max={1} step={0.01} onChange={(panX) => setDesignFit((f) => ({ ...f, panX }))} />
                      <Slider label="Up / down" value={designFit.panY} min={-1} max={1} step={0.01} onChange={(panY) => setDesignFit((f) => ({ ...f, panY }))} />
                    </>
                  )}
                  <p className="text-[11px] leading-snug text-zinc-500">
                    {guide ? (
                      <>
                        <strong className="font-medium text-zinc-700">Drag the picture.</strong> Dark = camera and buttons (nothing prints).{' '}
                        <span className="text-indigo-600">Blue</span> wraps round the sides.
                      </>
                    ) : (
                      'Your design wraps around the edges too.'
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setDesignFit({ zoom: 1, panX: 0, panY: 0 })}
                    className="self-start text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Reset position
                  </button>
                </div>
              </div>
            )}
          </Section>

          <Section title="Angle">
            <div className="grid grid-cols-3 gap-1.5">
              {VIEW_NAMES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  disabled={!selectedModel}
                  onClick={() => setViewRequest((r) => ({ name: v.id, n: r.n + 1 }))}
                  className="px-2 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
                >
                  {v.label}
                </button>
              ))}
            </div>
            <label className="mt-2.5 flex items-center gap-2 text-xs text-zinc-600 cursor-pointer w-fit">
              <input type="checkbox" checked={autoSpin} onChange={(e) => setAutoSpin(e.target.checked)} className="accent-indigo-600" />
              Spin slowly
            </label>
          </Section>

          <Section title="Background">
            <Segmented
              options={[
                ['presets', 'Presets'],
                ['upload', 'Your photo'],
                ['colour', 'Colour'],
              ]}
              value={bgTab}
              onChange={(tab) => {
                setBgTab(tab)
                if (tab === 'colour') setBackdropId('custom')
              }}
            />
            {bgTab === 'presets' && (
              <div className="grid grid-cols-3 gap-2">
                {STUDIO_COLORS.map((c) => (
                  <Swatch key={c.id} selected={backdropId === c.id} label={c.label} onClick={() => setBackdropId(c.id)}>
                    <div className="h-9" style={{ background: c.value }} />
                  </Swatch>
                ))}
                {/* The preset photos below set crossOrigin on purpose: the same file is also loaded as the 3D
                    background in CORS mode, and if this small preview were loaded without it the browser would
                    cache that copy (which has no CORS headers) and then reject the 3D load. */}
                {scenes.map((s) => {
                  const id = `scene:${s.id}`
                  return (
                    <Swatch key={id} selected={backdropId === id} label={s.name} onClick={() => setBackdropId(id)}>
                      {s.backgroundImageUrl ? (
                        <img src={resolveImageUrl(s.backgroundImageUrl)} crossOrigin="anonymous" alt="" className="h-9 w-full object-cover" />
                      ) : (
                        <div className="h-9" style={{ background: `linear-gradient(to bottom, ${s.backgroundTopColor}, ${s.backgroundBottomColor})` }} />
                      )}
                    </Swatch>
                  )
                })}
              </div>
            )}
            {bgTab === 'upload' && (
              <DesignDropzone compact file={bgFile} onChange={chooseUpload} label="Click or drag a background photo" hint="We fit it to the frame" previewAlt="Your background" />
            )}
            {bgTab === 'colour' && (
              <label className="flex items-center gap-3 text-xs text-zinc-600">
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => {
                    setCustomColor(e.target.value)
                    setBackdropId('custom')
                  }}
                  className="w-12 h-9 rounded border border-zinc-300 bg-white p-0.5"
                />
                Pick any background colour
              </label>
            )}
          </Section>

          <Section title="Look">
            <div className="flex flex-col gap-3">
              {ownLook ? (
                <p className="text-xs text-zinc-500">This case keeps the material finish it was made with.</p>
              ) : (
                <Slider label="Case finish" hint="glossy ← → matte" value={roughness} min={0.1} max={1} step={0.01} onChange={setRoughness} />
              )}
              <Slider label="Light" value={lightStrength} min={0.3} max={2.5} step={0.05} onChange={setLightStrength} />
              {hasTrim && (
                <label className="flex items-center justify-between text-xs text-zinc-600">
                  Case rim / inside colour
                  <input
                    type="color"
                    value={trimColor}
                    onChange={(e) => {
                      setTrimColor(e.target.value)
                      setTrimTouched(true)
                    }}
                    className="w-12 h-8 rounded border border-zinc-300 bg-white p-0.5"
                  />
                </label>
              )}
              <label className="hidden lg:flex items-center gap-2 text-xs text-zinc-600 cursor-pointer w-fit">
                <input type="checkbox" checked={showFrame} onChange={(e) => setShowFrame(e.target.checked)} className="accent-indigo-600" />
                Show the area the downloaded picture covers
              </label>
            </div>
          </Section>
        </div>

        <div className="border-t border-zinc-200 p-3 flex flex-col gap-2">
          <Button onClick={handleDownload} disabled={!canDownload} loading={downloading} className="w-full py-2.5">
            <Download className="w-4 h-4" /> {downloading ? 'Creating your image...' : 'Download image'}
          </Button>
          {selectedModel && !designImage && <p className="text-xs text-zinc-400 text-center">Upload a design to enable the download.</p>}
          {saveNote && <p className="text-[11px] text-zinc-500 break-all">{saveNote}</p>}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </aside>
    </div>
  )
}
