import { API_BASE_URL, apiFetch, silentRefresh, setAuthToken } from './client'

export async function login(email, password) {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error('Invalid email or password')
  const data = await res.json()
  setAuthToken(data.accessToken)
  return data.user
}

export async function tryRestoreSession() {
  const data = await silentRefresh()
  return data.user
}

export async function logout() {
  await apiFetch('/api/auth/logout', { method: 'POST' })
  setAuthToken(null)
}

export async function listUsers() {
  const res = await apiFetch('/api/users')
  if (!res.ok) throw new Error('Failed to load team')
  return res.json()
}

export async function createUser(email, password, role) {
  const res = await apiFetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || 'Failed to create user')
  }
  return res.json()
}
