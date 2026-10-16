import { apiFetch } from './client'

/// Records a picture the browser rendered from a 3D model: stores the finished PNG, the design file
/// and any uploaded background on the server and returns the saved generation (with its permanent
/// outputImageUrl), the same shape the 2D generator returns. Nothing is rendered on the server.
export async function saveRenderedHero({ heroModelId, designFile, outputBlob, sceneId, backgroundFile }) {
  const formData = new FormData()
  formData.append('heroModelId', heroModelId)
  formData.append('design', designFile)
  formData.append('output', outputBlob, 'hero.png')
  if (sceneId) formData.append('sceneId', sceneId)
  if (backgroundFile) formData.append('backgroundImage', backgroundFile)

  const res = await apiFetch('/api/herogenerations/rendered', { method: 'POST', body: formData })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || 'Failed to save the picture')
  }
  return res.json()
}

export async function generateHero(heroModelId, designFile, sceneId, backgroundFile, yawDegrees) {
  const formData = new FormData()
  formData.append('heroModelId', heroModelId)
  formData.append('design', designFile)
  if (sceneId) formData.append('sceneId', sceneId)
  if (backgroundFile) formData.append('backgroundImage', backgroundFile)
  if (yawDegrees) formData.append('yawDegrees', yawDegrees)

  const res = await apiFetch('/api/herogenerations', { method: 'POST', body: formData })
  if (!res.ok) throw new Error('Failed to generate hero image')
  return res.json()
}
