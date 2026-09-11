import { useState } from 'react'
import { Loader2, Wand2, ImageOff, MousePointer2, ShieldX, ShieldCheck, RotateCcw } from 'lucide-react'
import { detectTilted, bakeCameraMask, previewTiltedRender } from '../api/heroModels'
import CameraOutlineEditor from './CameraOutlineEditor'
import Button from './Button'

/// Admin-only: upload a tilted photo, auto-detect runs immediately and seeds a starting camera-area
/// outline (as real editable points, not a roundness/margin slider -- real camera-bump shapes
/// differ structurally across phone brands, not just numerically, so no small parameter family can
/// represent them all). The admin refines the outline directly over the photo, plus two spot tools
/// for isolated trouble spots, and re-bakes the preview as many times as needed before saving.
///
/// The camera module area always stays in its real photographed color and never gets the design --
/// confirmed against hero-156.png (a working Straight example): every real phone's camera bump is
/// its own distinct part of the product, shown as-is, on every phone, always. The outline is how
/// the admin tells the system exactly where that area is for THIS phone; there's no per-model
/// on/off choice on purpose.
///
/// Calls onReady(fields | null) whenever the detection result the parent should save changes --
/// null while there's no usable result yet (so the parent's Save button stays disabled).
export default function TiltedModelForm({ onReady }) {
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null)
  const [detecting, setDetecting] = useState(false)
  const [baking, setBaking] = useState(false)
  const [preview, setPreview] = useState(null)
  const [testImageUrl, setTestImageUrl] = useState(null)
  const [outline, setOutline] = useState([])
  const [spots, setSpots] = useState([])
  const [mode, setMode] = useState('outline')
  const [error, setError] = useState('')

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreviewUrl(URL.createObjectURL(file))
    setPreview(null)
    setTestImageUrl(null)
    setOutline([])
    setSpots([])
    onReady(null)
    await runDetect(file)
  }

  async function runDetect(file) {
    setDetecting(true)
    setError('')
    try {
      const result = await detectTilted(file)
      setPreview(result)
      const startOutline = JSON.parse(result.cameraOutlinePointsJson)
      setOutline(startOutline)
      setSpots([])
      emitReady(result, startOutline, [])
      await runPreviewRender(result)
    } catch {
      setError('Detection failed — try a photo with a cleaner, darker background behind the case.')
      onReady(null)
    } finally {
      setDetecting(false)
    }
  }

  function emitReady(result, outlinePts, spotsList) {
    onReady({
      baseImageUrl: result.baseImageUrl,
      designMaskImageUrl: result.silhouetteImageUrl,
      cameraMaskImageUrl: result.cameraMaskImageUrl,
      overlayImageUrl: result.overlayImageUrl,
      designQuadJson: result.designQuadJson,
      caseBboxJson: result.caseBboxJson,
      cameraOutlinePointsJson: JSON.stringify(outlinePts),
      cameraSpotsJson: JSON.stringify(spotsList),
    })
  }

  async function runPreviewRender(result) {
    try {
      const sampleRes = await fetch('/sample-preview-design.jpg')
      const sampleBlob = await sampleRes.blob()
      const url = await previewTiltedRender(result, new File([sampleBlob], 'sample.jpg'))
      setTestImageUrl(url)
    } catch {
      setError('Preview render failed.')
    }
  }

  async function handleUpdatePreview() {
    if (!preview || baking) return
    setBaking(true)
    setError('')
    try {
      const outlineJson = JSON.stringify(outline)
      const spotsJson = JSON.stringify(spots)
      const { cameraMaskImageUrl } = await bakeCameraMask(preview.baseImageUrl, outlineJson, spotsJson)
      const updatedPreview = { ...preview, cameraMaskImageUrl }
      setPreview(updatedPreview)
      emitReady(updatedPreview, outline, spots)
      await runPreviewRender(updatedPreview)
    } catch {
      setError('Updating the preview failed.')
    } finally {
      setBaking(false)
    }
  }

  function handleResetOutline() {
    if (!preview) return
    const startOutline = JSON.parse(preview.cameraOutlinePointsJson)
    setOutline(startOutline)
    setSpots([])
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-zinc-600">Tilted photo</label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handlePhotoSelect}
          className="text-sm text-zinc-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer"
        />
      </div>

      {detecting && (
        <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Detecting the case shape and camera area — this can take up to 30 seconds...
        </div>
      )}

      {preview && !detecting && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 bg-zinc-50">
              <ModeButton active={mode === 'outline'} onClick={() => setMode('outline')} icon={MousePointer2} label="Edit outline" />
              <ModeButton active={mode === 'protect'} onClick={() => setMode('protect')} icon={ShieldX} label="Protect spot" />
              <ModeButton active={mode === 'allow'} onClick={() => setMode('allow')} icon={ShieldCheck} label="Allow spot" />
            </div>
            <Button type="button" variant="secondary" onClick={handleResetOutline} disabled={baking}>
              <RotateCcw className="w-4 h-4" /> Reset to auto-detected
            </Button>
            <Button type="button" variant="secondary" onClick={handleUpdatePreview} disabled={baking}>
              {baking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Update preview
            </Button>
          </div>

          <p className="text-xs text-zinc-500">
            {mode === 'outline' && 'Drag a point to move it, click a point to remove it, click empty space to add one — trace the real camera module boundary.'}
            {mode === 'protect' && 'Click a spot on the camera area that must stay untouched (a missed hole, a logo). Click a marker to remove it.'}
            {mode === 'allow' && 'Click a spot inside the outline that should actually get the design (case body wrongly excluded). Click a marker to remove it.'}
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-medium text-zinc-600 mb-1.5">Camera outline editor</div>
              <div className="rounded-lg border border-zinc-200 w-full aspect-[3/4] bg-zinc-50 overflow-hidden">
                <CameraOutlineEditor
                  imageUrl={photoPreviewUrl}
                  outline={outline}
                  spots={spots}
                  onOutlineChange={setOutline}
                  onSpotsChange={setSpots}
                  mode={mode}
                />
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-600 mb-1.5">Test preview (sample design)</div>
              <div className="rounded-lg border border-zinc-200 w-full aspect-[3/4] bg-zinc-50 flex items-center justify-center overflow-hidden">
                {baking ? (
                  <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                ) : testImageUrl ? (
                  <img src={testImageUrl} alt="Test preview" className="max-w-full max-h-full object-contain" />
                ) : (
                  <ImageOff className="w-5 h-5 text-zinc-300" />
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-zinc-500">
            After adjusting the outline or spots, click "Update preview" to see the actual result. The camera module itself always
            stays untouched — that's correct on every phone.
          </p>
        </>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}

function ModeButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
        active ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  )
}
