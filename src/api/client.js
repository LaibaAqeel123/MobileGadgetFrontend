export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5299'

export function resolveImageUrl(url) {
  if (!url) return url
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`
}
