export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5299'

export function resolveImageUrl(url) {
  if (!url) return url
  return url.startsWith('http') ? url : `${API_BASE_URL}/api${url}`
}

// Access token lives in memory only (never localStorage) — cleared on refresh/tab close.
// The refresh token is an httpOnly cookie the browser attaches automatically.
let authToken = null
let unauthorizedHandler = null
let refreshPromise = null

export function setAuthToken(token) {
  authToken = token
}

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn
}

async function doRefresh() {
  const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
  if (!res.ok) {
    authToken = null
    throw new Error('Session expired')
  }
  const data = await res.json()
  authToken = data.accessToken
  return data
}

export async function silentRefresh() {
  return doRefresh()
}

/// Wraps fetch: attaches the access token, sends the refresh cookie, and on a 401
/// transparently retries once after a silent refresh — so a mid-session token expiry
/// doesn't interrupt whatever the user was doing.
export async function apiFetch(path, options = {}, _retried = false) {
  const headers = new Headers(options.headers || {})
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`)

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: 'include' })

  if (res.status === 401 && !_retried && !path.startsWith('/api/auth/')) {
    try {
      if (!refreshPromise) refreshPromise = doRefresh().finally(() => { refreshPromise = null })
      await refreshPromise
      return apiFetch(path, options, true)
    } catch {
      if (unauthorizedHandler) unauthorizedHandler()
    }
  }

  return res
}
