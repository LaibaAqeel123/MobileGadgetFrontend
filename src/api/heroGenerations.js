import { apiFetch } from './client'

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
