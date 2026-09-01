import { apiFetch } from './client'

export async function listScenes() {
  const res = await apiFetch('/api/scenes')
  if (!res.ok) throw new Error('Failed to load scenes')
  return res.json()
}

export async function createScene({ name, backgroundImageUrl }) {
  const res = await apiFetch('/api/scenes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, backgroundImageUrl }),
  })
  if (!res.ok) throw new Error('Failed to save background')
  return res.json()
}

export async function deleteScene(id) {
  const res = await apiFetch(`/api/scenes/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete background')
}
