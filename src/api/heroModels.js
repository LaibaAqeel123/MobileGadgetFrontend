import { API_BASE_URL } from './client'

export async function listHeroModels() {
  const res = await fetch(`${API_BASE_URL}/api/heromodels`)
  if (!res.ok) throw new Error('Failed to load hero models')
  return res.json()
}

export async function uploadImage(file) {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${API_BASE_URL}/api/uploads/image`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error('Failed to upload image')
  const data = await res.json()
  return data.url
}

export async function createHeroModel(payload) {
  const res = await fetch(`${API_BASE_URL}/api/heromodels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to save hero model')
  return res.json()
}

export async function deleteHeroModel(id) {
  const res = await fetch(`${API_BASE_URL}/api/heromodels/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete hero model')
}
