import { API_BASE_URL } from './client'

export async function listScenes() {
  const res = await fetch(`${API_BASE_URL}/api/scenes`)
  if (!res.ok) throw new Error('Failed to load scenes')
  return res.json()
}
