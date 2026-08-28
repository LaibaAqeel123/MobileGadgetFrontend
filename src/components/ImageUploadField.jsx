import { useState } from 'react'
import { uploadImage } from '../api/heroModels'
import { resolveImageUrl } from '../api/client'

export default function ImageUploadField({ label, value, onChange }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    try {
      const url = await uploadImage(file)
      onChange(url)
    } catch {
      setError('Upload failed. Try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-3">
        {value && (
          <img src={resolveImageUrl(value)} alt={label} className="w-16 h-16 object-contain border border-gray-200 rounded bg-gray-50" />
        )}
        <input type="file" accept="image/png,image/webp,image/jpeg" onChange={handleFileSelect} disabled={uploading} />
      </div>
      {uploading && <span className="text-xs text-gray-400">Uploading...</span>}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
