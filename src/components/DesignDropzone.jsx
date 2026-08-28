import { useEffect, useId, useState } from 'react'
import { Upload, X } from 'lucide-react'

export default function DesignDropzone({ file, onChange }) {
  const inputId = useId()
  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function handleSelect(e) {
    const f = e.target.files?.[0]
    if (f) onChange(f)
  }

  function handleDrop(e) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) onChange(f)
  }

  if (previewUrl) {
    return (
      <div className="relative rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50 aspect-video flex items-center justify-center">
        <img src={previewUrl} alt="Your design" className="max-w-full max-h-full object-contain" />
        <button
          onClick={() => onChange(null)}
          aria-label="Remove design"
          className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-full p-1.5 shadow-sm text-zinc-500 hover:text-zinc-900"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <label
      htmlFor={inputId}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="flex flex-col items-center justify-center gap-2 aspect-video rounded-xl border-2 border-dashed border-zinc-300 hover:border-indigo-400 hover:bg-indigo-50/40 cursor-pointer transition-colors"
    >
      <Upload className="w-6 h-6 text-zinc-400" />
      <span className="text-sm text-zinc-500">Click or drag a design image here</span>
      <span className="text-xs text-zinc-400">PNG, JPG, or WebP</span>
      <input id={inputId} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleSelect} className="sr-only" />
    </label>
  )
}
