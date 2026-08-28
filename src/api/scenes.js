import { apiFetch } from './client'

export async function listScenes() {
  const res = await apiFetch('/api/scenes')
  if (!res.ok) throw new Error('Failed to load scenes')
  return res.json()
}
