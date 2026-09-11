import { apiFetch } from './client'

export async function listHeroModels() {
  const res = await apiFetch('/api/heromodels')
  if (!res.ok) throw new Error('Failed to load hero models')
  return res.json()
}

export async function uploadImage(file) {
  const formData = new FormData()
  formData.append('file', file)

  const res = await apiFetch('/api/uploads/image', { method: 'POST', body: formData })
  if (!res.ok) throw new Error('Failed to upload image')
  const data = await res.json()
  return data.url
}

export async function createHeroModel(payload) {
  const res = await apiFetch('/api/heromodels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to save hero model')
  return res.json()
}

export async function deleteHeroModel(id) {
  const res = await apiFetch(`/api/heromodels/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete hero model')
}

// PoseType is serialized as its raw enum number (no string converter configured server-side) --
// 0 = Straight, 1 = Tilted, matching HeroModelPoseType's declaration order exactly.
export const POSE_STRAIGHT = 0
export const POSE_TILTED = 1

/// Runs auto-detection on an admin-uploaded tilted photo. Saves the photo + 3 mask images (so
/// they're ready to preview/save) but creates no HeroModel yet -- that's a separate save step.
export async function detectTilted(photoFile, cameraRoundR, cameraPadPx) {
  const formData = new FormData()
  formData.append('photo', photoFile)
  if (cameraRoundR != null) formData.append('cameraRoundR', cameraRoundR)
  if (cameraPadPx != null) formData.append('cameraPadPx', cameraPadPx)

  const res = await apiFetch('/api/heromodels/detect-tilted', { method: 'POST', body: formData })
  if (!res.ok) throw new Error('Detection failed')
  return res.json()
}

/// Renders one test composite from an in-progress (not-yet-saved) detection preview, so the admin
/// can see an actual "design applied to the case" image before deciding to save. Returns a blob
/// URL ready for an <img src>.
export async function previewTiltedRender(preview, sampleDesignFile) {
  const formData = new FormData()
  formData.append('baseImageUrl', preview.baseImageUrl)
  formData.append('silhouetteImageUrl', preview.silhouetteImageUrl)
  formData.append('cameraMaskImageUrl', preview.cameraMaskImageUrl)
  formData.append('overlayImageUrl', preview.overlayImageUrl)
  formData.append('designQuadJson', preview.designQuadJson)
  formData.append('caseBboxJson', preview.caseBboxJson)
  formData.append('design', sampleDesignFile)

  const res = await apiFetch('/api/heromodels/preview-tilted', { method: 'POST', body: formData })
  if (!res.ok) throw new Error('Preview render failed')
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
