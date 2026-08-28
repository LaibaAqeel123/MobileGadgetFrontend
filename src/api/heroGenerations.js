import { API_BASE_URL } from './client'

export async function generateHero(heroModelId, designFile) {
  const formData = new FormData()
  formData.append('heroModelId', heroModelId)
  formData.append('design', designFile)

  const res = await fetch(`${API_BASE_URL}/api/herogenerations`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error('Failed to generate hero image')
  return res.json()
}
