import { useEffect, useState } from 'react'
import { Trash2, Smartphone, Loader2 } from 'lucide-react'
import { listHeroModels, createHeroModel, deleteHeroModel } from '../../api/heroModels'
import { resolveImageUrl } from '../../api/client'
import ImageUploadField from '../../components/ImageUploadField'
import Button from '../../components/Button'

const EMPTY_FORM = {
  phoneName: '',
  caseType: '',
  baseImageUrl: '',
  designMaskImageUrl: '',
  cameraMaskImageUrl: '',
  overlayImageUrl: '',
}

export default function HeroModelManager() {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    try {
      setModels(await listHeroModels())
    } catch {
      setError('Failed to load models.')
    } finally {
      setLoading(false)
    }
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const isComplete =
    form.phoneName.trim() &&
    form.caseType.trim() &&
    form.baseImageUrl &&
    form.designMaskImageUrl &&
    form.cameraMaskImageUrl &&
    form.overlayImageUrl

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isComplete) return

    setSaving(true)
    setError('')
    try {
      await createHeroModel({
        phoneName: form.phoneName.trim(),
        caseType: form.caseType.trim(),
        baseImageUrl: form.baseImageUrl,
        designMaskImageUrl: form.designMaskImageUrl,
        cameraMaskImageUrl: form.cameraMaskImageUrl,
        overlayImageUrl: form.overlayImageUrl,
      })
      setForm(EMPTY_FORM)
      await refresh()
    } catch {
      setError('Failed to save model.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this model? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteHeroModel(id)
      await refresh()
    } catch {
      setError('Failed to delete model.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-900">Model Manager</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Add a phone + case with its 4 layer images. Once saved, it's available in the Generator.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-xl p-6 mb-10 flex flex-col gap-6 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-600">Phone name</label>
            <input
              type="text"
              value={form.phoneName}
              onChange={(e) => updateField('phoneName', e.target.value)}
              placeholder="e.g. iPhone 16 Pro"
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-600">Case type</label>
            <input
              type="text"
              value={form.caseType}
              onChange={(e) => updateField('caseType', e.target.value)}
              placeholder="e.g. Silicone Case"
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <ImageUploadField label="Base" value={form.baseImageUrl} onChange={(v) => updateField('baseImageUrl', v)} />
          <ImageUploadField label="Design mask" value={form.designMaskImageUrl} onChange={(v) => updateField('designMaskImageUrl', v)} />
          <ImageUploadField label="Camera mask" value={form.cameraMaskImageUrl} onChange={(v) => updateField('cameraMaskImageUrl', v)} />
          <ImageUploadField label="Overlay" value={form.overlayImageUrl} onChange={(v) => updateField('overlayImageUrl', v)} />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div>
          <Button type="submit" disabled={!isComplete} loading={saving}>
            {saving ? 'Saving...' : 'Add model'}
          </Button>
        </div>
      </form>

      <h2 className="text-sm font-medium text-zinc-600 mb-3">Existing models</h2>
      {loading ? (
        <div className="flex items-center gap-2 text-zinc-400 text-sm py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : models.length === 0 ? (
        <div className="flex flex-col items-center gap-2 text-zinc-400 py-16 border border-dashed border-zinc-200 rounded-xl">
          <Smartphone className="w-6 h-6" />
          <p className="text-sm">No models yet — add one above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {models.map((m) => (
            <div key={m.id} className="group bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
              <div className="aspect-square bg-zinc-50 flex items-center justify-center p-4">
                <img src={resolveImageUrl(m.baseImageUrl)} alt="" className="max-w-full max-h-full object-contain" />
              </div>
              <div className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-zinc-900 truncate">{m.phoneName}</div>
                  <div className="text-xs text-zinc-500 truncate">{m.caseType}</div>
                </div>
                <button
                  onClick={() => handleDelete(m.id)}
                  disabled={deletingId === m.id}
                  aria-label="Delete model"
                  className="shrink-0 p-1.5 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  {deletingId === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
