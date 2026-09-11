import { useEffect, useMemo, useState } from 'react'
import { Trash2, Smartphone, Loader2, Search, Pencil, X } from 'lucide-react'
import { listHeroModels, createHeroModel, updateHeroModel, deleteHeroModel, POSE_STRAIGHT, POSE_TILTED } from '../../api/heroModels'
import { resolveImageUrl } from '../../api/client'
import ImageUploadField from '../../components/ImageUploadField'
import TiltedModelForm from '../../components/TiltedModelForm'
import Button from '../../components/Button'

const EMPTY_STRAIGHT_FIELDS = {
  baseImageUrl: '',
  designMaskImageUrl: '',
  cameraMaskImageUrl: '',
  overlayImageUrl: '',
}

export default function HeroModelManager() {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [poseType, setPoseType] = useState(POSE_STRAIGHT)
  const [phoneName, setPhoneName] = useState('')
  const [caseType, setCaseType] = useState('')
  const [straightFields, setStraightFields] = useState(EMPTY_STRAIGHT_FIELDS)
  const [tiltedFields, setTiltedFields] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editingTiltedModel, setEditingTiltedModel] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

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

  function resetForm() {
    setPhoneName('')
    setCaseType('')
    setStraightFields(EMPTY_STRAIGHT_FIELDS)
    setTiltedFields(null)
    setEditingId(null)
    setEditingTiltedModel(null)
  }

  function updateStraightField(key, value) {
    setStraightFields((prev) => ({ ...prev, [key]: value }))
  }

  // Reopens an already-saved model in the form above, exactly as last saved (same photo, outline,
  // spots for Tilted) -- so improving one model doesn't mean re-uploading the photo and redoing
  // detection from scratch, just refining what's already there.
  function handleEdit(m) {
    setPhoneName(m.phoneName)
    setCaseType(m.caseType)
    setPoseType(m.poseType)
    setEditingId(m.id)
    if (m.poseType === POSE_STRAIGHT) {
      setStraightFields({
        baseImageUrl: m.baseImageUrl,
        designMaskImageUrl: m.designMaskImageUrl,
        cameraMaskImageUrl: m.cameraMaskImageUrl,
        overlayImageUrl: m.overlayImageUrl,
      })
      setEditingTiltedModel(null)
      setTiltedFields(null)
    } else {
      setEditingTiltedModel(m)
      setTiltedFields(null) // TiltedModelForm's own effect (keyed by editingId below) fills this in
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isComplete =
    phoneName.trim() &&
    caseType.trim() &&
    (poseType === POSE_STRAIGHT
      ? straightFields.baseImageUrl && straightFields.designMaskImageUrl && straightFields.cameraMaskImageUrl && straightFields.overlayImageUrl
      : tiltedFields !== null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isComplete) return

    setSaving(true)
    setError('')
    try {
      const payload = {
        phoneName: phoneName.trim(),
        caseType: caseType.trim(),
        poseType,
        ...(poseType === POSE_STRAIGHT ? straightFields : tiltedFields),
      }
      if (editingId) {
        await updateHeroModel(editingId, payload)
      } else {
        await createHeroModel(payload)
      }
      resetForm()
      await refresh()
    } catch {
      setError('Failed to save model.')
    } finally {
      setSaving(false)
    }
  }

  const filteredModels = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return models
    return models.filter((m) => `${m.phoneName} ${m.caseType}`.toLowerCase().includes(q))
  }, [models, query])

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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-900">Model Manager</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Add a phone + case. Once saved, it's available in the Generator.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-6 mb-10 flex flex-col gap-6 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-600">Phone name</label>
            <input
              type="text"
              value={phoneName}
              onChange={(e) => setPhoneName(e.target.value)}
              placeholder="e.g. iPhone 16 Pro"
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-600">Case type</label>
            <input
              type="text"
              value={caseType}
              onChange={(e) => setCaseType(e.target.value)}
              placeholder="e.g. Silicone Case"
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-600">Pose</label>
          <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 bg-zinc-50 w-fit">
            <button
              type="button"
              onClick={() => {
                setPoseType(POSE_STRAIGHT)
                setTiltedFields(null)
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                poseType === POSE_STRAIGHT ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Straight
            </button>
            <button
              type="button"
              onClick={() => setPoseType(POSE_TILTED)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                poseType === POSE_TILTED ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Tilted
            </button>
          </div>
        </div>

        {poseType === POSE_STRAIGHT ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <ImageUploadField label="Base" value={straightFields.baseImageUrl} onChange={(v) => updateStraightField('baseImageUrl', v)} />
            <ImageUploadField label="Design mask" value={straightFields.designMaskImageUrl} onChange={(v) => updateStraightField('designMaskImageUrl', v)} />
            <ImageUploadField label="Camera mask" value={straightFields.cameraMaskImageUrl} onChange={(v) => updateStraightField('cameraMaskImageUrl', v)} />
            <ImageUploadField label="Overlay" value={straightFields.overlayImageUrl} onChange={(v) => updateStraightField('overlayImageUrl', v)} />
          </div>
        ) : (
          <TiltedModelForm key={editingId ?? 'new'} onReady={setTiltedFields} initialModel={editingTiltedModel} />
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={!isComplete} loading={saving}>
            {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add model'}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={resetForm} disabled={saving}>
              <X className="w-4 h-4" /> Cancel edit
            </Button>
          )}
        </div>
      </form>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-3">
        <h2 className="text-sm font-medium text-zinc-600 shrink-0">Existing models</h2>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by phone or case type..."
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-zinc-400 text-sm py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : models.length === 0 ? (
        <div className="flex flex-col items-center gap-2 text-zinc-400 py-16 border border-dashed border-zinc-200 rounded-xl">
          <Smartphone className="w-6 h-6" />
          <p className="text-sm">No models yet — add one above.</p>
        </div>
      ) : filteredModels.length === 0 ? (
        <div className="flex flex-col items-center gap-2 text-zinc-400 py-16 border border-dashed border-zinc-200 rounded-xl">
          <Search className="w-6 h-6" />
          <p className="text-sm">No models match "{query}".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModels.map((m) => (
            <div key={m.id} className="group bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
              <div className="aspect-square bg-zinc-50 flex items-center justify-center p-4">
                <img src={resolveImageUrl(m.baseImageUrl)} alt="" className="max-w-full max-h-full object-contain" />
              </div>
              <div className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-zinc-900 truncate">{m.phoneName}</div>
                  <div className="text-xs text-zinc-500 truncate">
                    {m.caseType} · {m.poseType === POSE_TILTED ? 'Tilted' : 'Straight'}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(m)}
                    aria-label="Edit model"
                    className="p-1.5 rounded-md text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(m.id)}
                    disabled={deletingId === m.id}
                    aria-label="Delete model"
                    className="p-1.5 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    {deletingId === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
