import { useEffect, useState } from 'react'
import { listHeroModels, createHeroModel, deleteHeroModel } from '../../api/heroModels'
import { resolveImageUrl } from '../../api/client'
import ImageUploadField from '../../components/ImageUploadField'

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
    if (!confirm('Delete this model?')) return
    try {
      await deleteHeroModel(id)
      await refresh()
    } catch {
      setError('Failed to delete model.')
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-medium mb-1">Model Manager</h1>
      <p className="text-gray-500 mb-6">Add a phone + case, with its 4 layer images.</p>

      <form onSubmit={handleSubmit} className="border border-gray-200 rounded-lg p-6 mb-8 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Phone name</label>
            <input
              type="text"
              value={form.phoneName}
              onChange={(e) => updateField('phoneName', e.target.value)}
              placeholder="e.g. iPhone 16 Pro"
              className="border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Case type</label>
            <input
              type="text"
              value={form.caseType}
              onChange={(e) => updateField('caseType', e.target.value)}
              placeholder="e.g. Silicone Case"
              className="border border-gray-300 rounded px-3 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <ImageUploadField label="Base" value={form.baseImageUrl} onChange={(v) => updateField('baseImageUrl', v)} />
          <ImageUploadField label="Design mask" value={form.designMaskImageUrl} onChange={(v) => updateField('designMaskImageUrl', v)} />
          <ImageUploadField label="Camera mask" value={form.cameraMaskImageUrl} onChange={(v) => updateField('cameraMaskImageUrl', v)} />
          <ImageUploadField label="Overlay" value={form.overlayImageUrl} onChange={(v) => updateField('overlayImageUrl', v)} />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={!isComplete || saving}
          className="self-start bg-black text-white px-4 py-2 rounded disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Add model'}
        </button>
      </form>

      <h2 className="text-lg font-medium mb-3">Existing models</h2>
      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : models.length === 0 ? (
        <p className="text-gray-400">No models yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {models.map((m) => (
            <li key={m.id} className="flex items-center gap-4 border border-gray-200 rounded p-3">
              <img src={resolveImageUrl(m.baseImageUrl)} alt="" className="w-12 h-12 object-contain bg-gray-50 rounded" />
              <div className="flex-1">
                <div className="font-medium">{m.phoneName}</div>
                <div className="text-sm text-gray-500">{m.caseType}</div>
              </div>
              <button onClick={() => handleDelete(m.id)} className="text-sm text-red-500 hover:underline">
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
