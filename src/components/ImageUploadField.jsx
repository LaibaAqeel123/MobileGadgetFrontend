import { useId, useState } from 'react'
import { Loader2, Upload, Check } from 'lucide-react'
import { uploadImage } from '../api/heroModels'
import { resolveImageUrl } from '../api/client'

export default function ImageUploadField({ label, value, onChange }) {
  const inputId = useId()
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
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-xs font-medium text-zinc-600">
        {label}
      </label>
      <label
        htmlFor={inputId}
        className={`relative flex flex-col items-center justify-center gap-1.5 aspect-square rounded-lg border-2 border-dashed cursor-pointer transition-colors overflow-hidden ${
          value ? 'border-zinc-200' : 'border-zinc-300 hover:border-indigo-400 hover:bg-indigo-50/40'
        }`}
      >
        {value ? (
          <>
            <img src={resolveImageUrl(value)} alt={label} className="absolute inset-0 w-full h-full object-contain bg-zinc-50 p-2" />
            <div className="absolute top-1.5 right-1.5 bg-white rounded-full p-0.5 shadow-sm">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            </div>
          </>
        ) : uploading ? (
          <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
        ) : (
          <>
            <Upload className="w-5 h-5 text-zinc-400" />
            <span className="text-xs text-zinc-400">Upload</span>
          </>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/png,image/webp,image/jpeg"
          onChange={handleFileSelect}
          disabled={uploading}
          className="sr-only"
        />
      </label>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
