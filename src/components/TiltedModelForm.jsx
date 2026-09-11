import { useState } from 'react'
import { Loader2, Wand2, ImageOff } from 'lucide-react'
import { detectTilted, previewTiltedRender } from '../api/heroModels'
import Button from './Button'

/// Admin-only: upload a tilted photo, auto-detect runs immediately, and an actual test composite
/// (using a bundled sample design) renders right after -- so the admin sees a real "design applied
/// to the case" preview, not just raw mask thumbnails, before deciding whether to save. Camera-area
/// roundness/margin can be nudged and re-detected as many times as needed; nothing is saved to a
/// HeroModel until the admin submits the surrounding form (see HeroModelManager).
///
/// Calls onReady(fields | null) whenever the detection result the parent should save changes --
/// null while there's no usable result yet (so the parent's Save button stays disabled).
export default function TiltedModelForm({ onReady }) {
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null)
  const [detecting, setDetecting] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [preview, setPreview] = useState(null)
  const [testImageUrl, setTestImageUrl] = useState(null)
  const [roundR, setRoundR] = useState(18)
  const [padPx, setPadPx] = useState(20)
  const [error, setError] = useState('')

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreviewUrl(URL.createObjectURL(file))
    setPreview(null)
    setTestImageUrl(null)
    onReady(null)
    await runDetect(file, roundR, padPx)
  }

  async function runDetect(file, r, p) {
    setDetecting(true)
    setError('')
    try {
      const result = await detectTilted(file, r, p)
      setPreview(result)
      onReady({
        baseImageUrl: result.baseImageUrl,
        designMaskImageUrl: result.silhouetteImageUrl,
        cameraMaskImageUrl: result.cameraMaskImageUrl,
        overlayImageUrl: result.overlayImageUrl,
        designQuadJson: result.designQuadJson,
        caseBboxJson: result.caseBboxJson,
        cameraRoundR: r,
        cameraPadPx: p,
      })
      await runPreviewRender(result)
    } catch {
      setError('Detection failed — try a photo with a cleaner, darker background behind the case.')
      onReady(null)
    } finally {
      setDetecting(false)
    }
  }

  async function runPreviewRender(result) {
    setRendering(true)
    try {
      const sampleRes = await fetch('/sample-preview-design.jpg')
      const sampleBlob = await sampleRes.blob()
      const url = await previewTiltedRender(result, new File([sampleBlob], 'sample.jpg'))
      setTestImageUrl(url)
    } catch {
      setError('Preview render failed.')
    } finally {
      setRendering(false)
    }
  }

  function handleRedetect() {
    if (photoFile && !detecting) runDetect(photoFile, roundR, padPx)
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-medium text-zinc-600 mb-1.5">Original photo</div>
              <div className="rounded-lg border border-zinc-200 w-full aspect-[3/4] bg-zinc-50 flex items-center justify-center overflow-hidden">
                <img src={photoPreviewUrl} alt="Original upload" className="max-w-full max-h-full object-contain" />
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-600 mb-1.5">Test preview (sample design)</div>
              <div className="rounded-lg border border-zinc-200 w-full aspect-[3/4] bg-zinc-50 flex items-center justify-center overflow-hidden">
                {rendering ? (
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
            Check both corners and the camera area on the test preview above. A little roundness/margin off? Nudge it below and re-detect —
            don't worry about getting this perfect on the first try.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-600">Camera area roundness ({roundR}px)</label>
              <input type="range" min="4" max="40" value={roundR} onChange={(e) => setRoundR(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-600">Camera area margin ({padPx}px)</label>
              <input type="range" min="4" max="40" value={padPx} onChange={(e) => setPadPx(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Button type="button" variant="secondary" onClick={handleRedetect} disabled={detecting}>
              <Wand2 className="w-4 h-4" /> Re-detect with these settings
            </Button>
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
