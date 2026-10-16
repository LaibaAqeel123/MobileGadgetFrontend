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

export async function updateHeroModel(id, payload) {
  const res = await apiFetch(`/api/heromodels/${id}`, {
    method: 'PUT',
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
export const POSE_MODEL3D = 2

async function errorFrom(res, fallback) {
  const data = await res.json().catch(() => null)
  return new Error(data?.error || fallback)
}

/// Uploads a .glb and runs the server-side check on it. Saves the file (so it can be previewed and
/// saved) but creates no HeroModel yet. A bad file is NOT an error here: it comes back as a report
/// with errors, so the admin sees why. Returns { glbUrl, report, printMaterialName, printLayoutJson }.
export async function inspectGlb(file, printMaterialName) {
  const formData = new FormData()
  formData.append('glb', file)
  if (printMaterialName) formData.append('printMaterialName', printMaterialName)

  const res = await apiFetch('/api/heromodels/inspect-glb', { method: 'POST', body: formData })
  if (!res.ok) throw await errorFrom(res, 'Could not check the 3D model file')
  return res.json()
}

/// Re-checks an already-uploaded .glb against a different printable material (the admin's pick
/// from the material list) without uploading it again.
export async function reinspectGlb(glbUrl, printMaterialName) {
  const formData = new FormData()
  formData.append('glbUrl', glbUrl)
  if (printMaterialName) formData.append('printMaterialName', printMaterialName)

  const res = await apiFetch('/api/heromodels/reinspect-glb', { method: 'POST', body: formData })
  if (!res.ok) throw await errorFrom(res, 'Could not re-check the 3D model file')
  return res.json()
}

/// Creates (no id) or updates (with id) a 3D model. Unlike the 2D saves above, the server's own
/// reason is passed through, because for 3D it is meaningful to the admin ("no PRINT_AREA found").
/// baseImageUrl is the model's list thumbnail (the 2D models use that field for their photo; a 3D model
/// has no photo, so its thumbnail lives there). Always sent, because an update overwrites it.
export async function saveModel3D({ id, phoneName, caseType, glbUrl, printMaterialName, baseImageUrl = '' }) {
  const payload = { phoneName, caseType, poseType: POSE_MODEL3D, glbUrl, printMaterialName, baseImageUrl }
  const res = await apiFetch(id ? `/api/heromodels/${id}` : '/api/heromodels', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw await errorFrom(res, 'Failed to save the 3D model')
  return res.json()
}

/// Runs auto-detection on an admin-uploaded tilted photo. Saves the photo + 3 mask images (so
/// they're ready to preview/save) but creates no HeroModel yet -- that's a separate save step.
/// The returned cameraOutlinePointsJson is a starting guess (already-close points around the
/// camera area) meant to be refined in the point editor, not used as-is.
export async function detectTilted(photoFile) {
  const formData = new FormData()
  formData.append('photo', photoFile)

  const res = await apiFetch('/api/heromodels/detect-tilted', { method: 'POST', body: formData })
  if (!res.ok) throw new Error('Detection failed')
  return res.json()
}

/// Fast path called after every point-editor edit: rasterizes a fresh camera mask directly from
/// the admin's current outline points + protect/allow spot overrides (no re-detection -- a couple
/// seconds, not ~30s) and returns its URL. Follow with previewTiltedRender to see it applied.
export async function bakeCameraMask(baseImageUrl, cameraOutlinePointsJson, cameraSpotsJson) {
  const formData = new FormData()
  formData.append('baseImageUrl', baseImageUrl)
  formData.append('cameraOutlinePointsJson', cameraOutlinePointsJson)
  formData.append('cameraSpotsJson', cameraSpotsJson)

  const res = await apiFetch('/api/heromodels/bake-camera-mask', { method: 'POST', body: formData })
  if (!res.ok) throw new Error('Failed to bake camera mask')
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
