import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Box, CheckCircle2, Loader2, Pencil, Trash2, Upload, X, XCircle } from 'lucide-react'
import { deleteHeroModel, inspectGlb, listHeroModels, POSE_MODEL3D, reinspectGlb, saveModel3D, uploadImage } from '../../api/heroModels'
import { resolveImageUrl } from '../../api/client'
import { makeTestDesignImage, makeThumbnailDesignImage } from '../../lib/testDesign'
import { VIEW_NAMES } from '../../lib/viewPresets'
import Model3DViewer from '../../components/Model3DViewer'
import Button from '../../components/Button'

const BACKDROPS = [
  { value: '#c9ccd3', label: 'Grey' },
  { value: '#e9e2d8', label: 'Cream' },
  { value: '#e8d3d6', label: 'Blush' },
  { value: '#2b2e36', label: 'Dark' },
]

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2.5">{title}</h2>
      {children}
    </section>
  )
}

function ReportPanel({ report, onPickMaterial, picking }) {
  if (!report) return null
  const usable = (report.materials || []).filter((m) => m.triangleCount > 0)
  return (
    <div className="flex flex-col gap-2.5">
      <div
        className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
          report.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
        }`}
      >
        {report.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
        <div className="min-w-0">
          <div className="font-medium">{report.ok ? 'This model can be used.' : 'This model cannot be saved yet.'}</div>
          {report.errors?.map((e) => (
            <p key={e} className="mt-1 text-xs break-words">{e}</p>
          ))}
        </div>
      </div>

      {report.warnings?.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 text-amber-900 px-3 py-2 text-xs">
          <AlertTriangle className="w-4 h-4 mt-px shrink-0" />
          <div>
            <div className="font-medium">Worth a look in the preview</div>
            {report.warnings.map((w) => (
              <p key={w} className="mt-1">{w}</p>
            ))}
          </div>
        </div>
      )}

      {usable.length > 0 && onPickMaterial && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-600">
            Printable material <span className="text-zinc-400">(where the design goes)</span>
          </span>
          <span className="flex items-center gap-2">
            <select
              value={report.printMaterialName || ''}
              disabled={picking}
              onChange={(e) => onPickMaterial(e.target.value)}
              className="flex-1 min-w-0 border border-zinc-300 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            >
              {!report.printMaterialName && <option value="">Choose a material...</option>}
              {usable.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name || '(unnamed)'} — {m.triangleCount.toLocaleString()} triangles{m.hasUvs ? '' : ', no UV map'}
                </option>
              ))}
            </select>
            {picking && <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />}
          </span>
        </label>
      )}

      <p className="text-[11px] text-zinc-400">
        {report.meshCount} parts · {report.triangleCount?.toLocaleString()} triangles
        {report.printLayout && ` · printable shape ${report.printLayout.aspect?.toFixed(3)} : 1 · stretch ${report.printLayout.stretchSpread?.toFixed(2)}x`}
      </p>
    </div>
  )
}

export default function Model3DManager() {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [phoneName, setPhoneName] = useState('')
  const [caseType, setCaseType] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null) // { glbUrl, report, printMaterialName, printLayoutJson }
  const [uploading, setUploading] = useState(false)
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [testDesign, setTestDesign] = useState(null)
  const [previewDesign, setPreviewDesign] = useState('pattern') // 'pattern' | 'grid' (the model's own material)
  const [viewRequest, setViewRequest] = useState({ name: 'back', n: 0 })
  const [backdrop, setBackdrop] = useState(BACKDROPS[0].value)
  const [loadStatus, setLoadStatus] = useState('')
  const fileInputRef = useRef(null)
  const viewerRef = useRef(null)
  const thumbDesignRef = useRef(null)
  // what the model being edited was saved with, so a rename keeps its thumbnail instead of redrawing it
  const [savedState, setSavedState] = useState(null) // { glbUrl, baseImageUrl }

  useEffect(() => {
    makeTestDesignImage().then(setTestDesign)
    makeThumbnailDesignImage().then((img) => {
      thumbDesignRef.current = img
    })
    refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    try {
      const all = await listHeroModels()
      setModels(all.filter((m) => m.poseType === POSE_MODEL3D))
    } catch {
      setError('Failed to load models.')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setPhoneName('')
    setCaseType('')
    setEditingId(null)
    setSavedState(null)
    setDraft(null)
    setError('')
    setLoadStatus('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFile(file) {
    if (!file) return
    setUploading(true)
    setError('')
    setLoadStatus('')
    try {
      setDraft(await inspectGlb(file))
    } catch (err) {
      setDraft(null)
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handlePickMaterial(name) {
    if (!draft || !name) return
    setPicking(true)
    setError('')
    try {
      setDraft(await reinspectGlb(draft.glbUrl, name))
    } catch (err) {
      setError(err.message)
    } finally {
      setPicking(false)
    }
  }

  function handleEdit(m) {
    setEditingId(m.id)
    setSavedState({ glbUrl: m.glbUrl, baseImageUrl: m.baseImageUrl || '' })
    setPhoneName(m.phoneName)
    setCaseType(m.caseType)
    setError('')
    setLoadStatus('')
    const stored = parseJson(m.validationReportJson)
    setDraft({
      glbUrl: m.glbUrl,
      printMaterialName: m.printMaterialName,
      printLayoutJson: m.printLayoutJson,
      report: stored ? { ...stored, ok: stored.ok ?? true } : { ok: true, errors: [], warnings: [], materials: [] },
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      // A new or replaced model gets a fresh thumbnail (a 3/4 view with a calm design on it); a rename
      // keeps the old one. The thumbnail is a nicety, so failing to make it never blocks saving.
      let baseImageUrl = savedState?.baseImageUrl || ''
      const fileChanged = !savedState || savedState.glbUrl !== draft.glbUrl
      if (fileChanged && viewerRef.current && thumbDesignRef.current) {
        try {
          const blob = await viewerRef.current.capture(512, { view: 'three', design: thumbDesignRef.current })
          baseImageUrl = await uploadImage(new File([blob], 'thumbnail.png', { type: 'image/png' }))
        } catch {
          baseImageUrl = ''
        }
      }
      await saveModel3D({
        id: editingId,
        phoneName: phoneName.trim(),
        caseType: caseType.trim(),
        glbUrl: draft.glbUrl,
        printMaterialName: draft.printMaterialName,
        baseImageUrl,
      })
      resetForm()
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this 3D model? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteHeroModel(id)
      if (editingId === id) resetForm()
      await refresh()
    } catch {
      setError('Failed to delete model.')
    } finally {
      setDeletingId(null)
    }
  }

  const canSave = Boolean(draft?.report?.ok && phoneName.trim() && caseType.trim() && !uploading && !picking)
  const layout = useMemo(() => parseJson(draft?.printLayoutJson), [draft?.printLayoutJson])
  const showPreview = Boolean(draft?.glbUrl && draft.report?.ok && layout)

  return (
    // Fills the screen under the top bar: a big preview on the left, one scrolling panel on the right.
    <div className="flex flex-col lg:flex-row h-[calc(100dvh-3.5rem-1px)] overflow-hidden">
      <input ref={fileInputRef} type="file" accept=".glb,model/gltf-binary" onChange={(e) => handleFile(e.target.files?.[0])} className="hidden" />

      {/* ---------------- preview ---------------- */}
      <div className="flex-none h-[46dvh] lg:h-auto lg:flex-1 min-h-0 flex flex-col bg-zinc-100">
        <div className="relative flex-1 min-h-0">
          {showPreview ? (
            <Model3DViewer
              ref={viewerRef}
              className="absolute inset-0"
              glbUrl={resolveImageUrl(draft.glbUrl)}
              printMaterialName={draft.printMaterialName}
              layout={layout}
              designImage={previewDesign === 'pattern' ? testDesign : null}
              viewRequest={viewRequest}
              backdrop={backdrop}
              onLoad={() => setLoadStatus('')}
              onError={() => setLoadStatus('The preview could not load this file.')}
            />
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                handleFile(e.dataTransfer.files?.[0])
              }}
              disabled={uploading}
              className="absolute inset-4 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 text-zinc-500 hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors"
            >
              {uploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
              <span className="text-sm font-medium">
                {uploading ? 'Checking the file...' : draft ? 'Fix the problem on the right, or choose another file' : 'Click or drop a .glb file here'}
              </span>
              <span className="text-xs text-zinc-400">A phone wearing its case, as one .glb file</span>
            </button>
          )}
          {showPreview && (
            <div className="absolute left-0 right-0 bottom-2 text-center text-[11px] text-zinc-500 pointer-events-none">
              Drag to turn · scroll to zoom
            </div>
          )}
        </div>

        {showPreview && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-t border-zinc-200 bg-white">
            {VIEW_NAMES.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setViewRequest((r) => ({ name: v.id, n: r.n + 1 }))}
                className="px-2.5 py-1 rounded-md border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-50"
              >
                {v.label}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-zinc-200" />
            {[
              ['pattern', 'Test pattern'],
              ['grid', "Model's own grid"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPreviewDesign(id)}
                className={`px-2.5 py-1 rounded-md border text-xs ${
                  previewDesign === id ? 'border-indigo-500 text-indigo-700 bg-indigo-50' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {label}
              </button>
            ))}
            <select
              value={backdrop}
              onChange={(e) => setBackdrop(e.target.value)}
              aria-label="Backdrop"
              className="ml-auto border border-zinc-200 rounded-md px-2 py-1 text-xs text-zinc-600 bg-white"
            >
              {BACKDROPS.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>
        )}
        {loadStatus && <p className="px-3 py-1.5 text-xs text-red-500 bg-white">{loadStatus}</p>}
      </div>

      {/* ---------------- panel ---------------- */}
      <aside className="flex-1 lg:flex-none lg:w-[400px] min-h-0 flex flex-col bg-white border-t lg:border-t-0 lg:border-l border-zinc-200">
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
          <Section title={editingId ? 'Editing a saved model' : 'Add a 3D model'}>
            <div className="flex flex-col gap-3">
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} loading={uploading} className="w-full">
                {!uploading && <Upload className="w-4 h-4" />} {draft ? 'Choose a different .glb file' : 'Choose .glb file'}
              </Button>
              <ReportPanel report={draft?.report} onPickMaterial={handlePickMaterial} picking={picking} />
            </div>
          </Section>

          {draft && (
            <Section title="Name it">
              <div className="flex flex-col gap-2.5">
                <input
                  type="text"
                  value={phoneName}
                  onChange={(e) => setPhoneName(e.target.value)}
                  placeholder="Phone name, e.g. iPhone 17 Pro Max"
                  className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
                <input
                  type="text"
                  value={caseType}
                  onChange={(e) => setCaseType(e.target.value)}
                  placeholder="Case type, e.g. Silicone Case"
                  className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={!canSave} loading={saving}>
                    {saving ? 'Saving...' : editingId ? 'Save changes' : 'Save model'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={resetForm} disabled={saving}>
                    <X className="w-4 h-4" /> {editingId ? 'Cancel' : 'Start over'}
                  </Button>
                </div>
              </div>
            </Section>
          )}
          {!draft && error && <p className="text-xs text-red-500">{error}</p>}

          <Section title={`Saved models${models.length ? ` (${models.length})` : ''}`}>
            {loading ? (
              <div className="flex items-center gap-2 text-zinc-400 text-sm py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : models.length === 0 ? (
              <p className="text-sm text-zinc-400">No 3D models yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {models.map((m) => (
                  <li key={m.id} className={`flex items-center gap-3 rounded-lg border p-2 ${editingId === m.id ? 'border-indigo-400 bg-indigo-50/40' : 'border-zinc-200'}`}>
                    <div className="w-10 h-10 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 overflow-hidden">
                      {m.baseImageUrl ? <img src={resolveImageUrl(m.baseImageUrl)} alt="" className="w-full h-full object-cover" /> : <Box className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-zinc-900 truncate">{m.phoneName}</div>
                      <div className="text-xs text-zinc-500 truncate">{m.caseType}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleEdit(m)}
                      aria-label="Edit model"
                      className="p-1.5 rounded-md text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      disabled={deletingId === m.id}
                      aria-label="Delete model"
                      className="p-1.5 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      {deletingId === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </form>
      </aside>
    </div>
  )
}
