import { useEffect, useState } from 'react'
import { Loader2, ImagePlus, Trash2, Palette } from 'lucide-react'
import { listScenes, createScene, deleteScene } from '../../api/scenes'
import { uploadImage } from '../../api/heroModels'
import { resolveImageUrl } from '../../api/client'
import Button from '../../components/Button'

export default function BackgroundManager() {
  const [scenes, setScenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    try {
      setScenes(await listScenes())
    } catch {
      setError('Failed to load backgrounds.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) return
    setSaving(true)
    setError('')
    try {
      const backgroundImageUrl = await uploadImage(file)
      await createScene({ name, backgroundImageUrl })
      setName('')
      setFile(null)
      e.target.reset()
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this background? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteScene(id)
      await refresh()
    } catch {
      setError('Failed to delete background.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-900">Backgrounds</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Add a photo backdrop customers can pick in the Generator, alongside the built-in colors.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-6 mb-10 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-600">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Marble Countertop"
            className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-600">Photo</label>
          <input
            required
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-zinc-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:text-zinc-700 file:text-sm hover:file:bg-zinc-200"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div>
          <Button type="submit" loading={saving}>
            <ImagePlus className="w-4 h-4" /> Add background
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-400 text-sm py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {scenes.map((s) => (
            <div key={s.id} className="group relative bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
              <div className="aspect-square bg-zinc-50">
                {s.backgroundImageUrl ? (
                  <img src={resolveImageUrl(s.backgroundImageUrl)} alt={s.name} className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: `linear-gradient(to bottom, ${s.backgroundTopColor}, ${s.backgroundBottomColor})` }}
                  >
                    <Palette className="w-5 h-5 text-white/70" />
                  </div>
                )}
              </div>
              <div className="p-2.5 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-900 truncate">{s.name}</span>
                {!s.isDefault && s.backgroundImageUrl && (
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={deletingId === s.id}
                    aria-label="Delete background"
                    className="shrink-0 p-1 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    {deletingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
