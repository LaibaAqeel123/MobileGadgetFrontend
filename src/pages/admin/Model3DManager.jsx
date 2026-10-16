import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Box, CheckCircle2, Loader2, Pencil, Trash2, Upload, X, XCircle } from 'lucide-react'
import { deleteHeroModel, inspectGlb, listHeroModels, POSE_MODEL3D, reinspectGlb, saveModel3D } from '../../api/heroModels'
import { resolveImageUrl } from '../../api/client'
import { makeTestDesignImage } from '../../lib/testDesign'
import Model3DViewer from '../../components/Model3DViewer'
import { VIEW_NAMES } from '../../lib/viewPresets'
import Button from '../../components/Button'

const BACKDROPS = [
  { value: '#c9ccd3', label: 'Studio grey' },
  { value: '#e9e2d8', label: 'Warm cream' },
  { value: '#e8d3d6', label: 'Soft blush' },
  { value: '#2b2e36', label: 'Dark' },
]

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

function ReportPanel({ report, onPickMaterial, picking }) {
  if (!report) return null
  const usable = (report.materials || []).filter((m) => m.triangleCount > 0)
  return (
    <div className="flex flex-col gap-3">
      <div
        className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
          report.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
        }`}
      >
        {report.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
        <div>
          <div className="font-medium">{report.ok ? 'This model can be used.' : 'This model cannot be saved yet.'}</div>
          {report.errors?.map((e) => (
            <p key={e} className="mt-1">{e}</p>
          ))}
        </div>
      </div>

      {report.warnings?.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 text-amber-900 px-3 py-2.5 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Worth a look in the preview</div>
            {report.warnings.map((w) => (
              <p key={w} className="mt-1">{w}</p>
            ))}
          </div>
        </div>
      )}

      {usable.length > 0 && onPickMaterial && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-600">
            Printable material <span className="font-normal text-zinc-400">(where the customer's design goes)</span>
          </label>
          <div className="flex items-center gap-2">
            <select
              value={report.printMaterialName || ''}
              disabled={picking}
              onChange={(e) => onPickMaterial(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            >
              {!report.printMaterialName && <option value="">Choose a material...</option>}
              {usable.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name || '(unnamed)'} — {m.triangleCount.toLocaleString()} triangles{m.hasUvs ? '' : ', no UV map'}
                </option>
              ))}
            </select>
            {picking && <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />}
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-zinc-500">
        <div><dt className="inline">Parts: </dt><dd className="inline text-zinc-700">{report.meshCount}</dd></div>
        <div><dt className="inline">Triangles: </dt><dd className="inline text-zinc-700">{report.triangleCount?.toLocaleString()}</dd></div>
        {report.printLayout && (
          <>
            <div>
              <dt className="inline">Printable shape: </dt>
              <dd className="inline text-zinc-700">{report.printLayout.aspect?.toFixed(3)} : 1</dd>
            </div>
            <div>
              <dt className="inline">Stretch: </dt>
              <dd className="inline text-zinc-700">{report.printLayout.stretchSpread?.toFixed(2)}x</dd>
            </div>
          </>
        )}
      </dl>
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
  const [viewRequest, setViewRequest] = useState({ name: 'back', n: 0 })
  const [backdrop, setBackdrop] = useState(BACKDROPS[0].value)
  const [loadStatus, setLoadStatus] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    makeTestDesignImage().then(setTestDesign)
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
    setDraft(null)
    setError('')
    setLoadStatus('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
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
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      await saveModel3D({
        id: editingId,
        phoneName: phoneName.trim(),
        caseType: caseType.trim(),
        glbUrl: draft.glbUrl,
        printMaterialName: draft.printMaterialName,
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-900">3D Models</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Upload a .glb of a phone wearing its case. We check it, you try a test design on it, then save it.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-6 mb-10 flex flex-col gap-6 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-600">
            3D model file (.glb) {editingId && <span className="font-normal text-zinc-400">— choose a file only to replace the saved one</span>}
          </label>
          <div className="flex items-center gap-3">
            <label
              className={`inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer ${
                uploading ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Checking the file...' : 'Choose .glb file'}
              <input ref={fileInputRef} type="file" accept=".glb,model/gltf-binary" onChange={handleFile} className="hidden" />
            </label>
          </div>
        </div>

        <ReportPanel report={draft?.report} onPickMaterial={handlePickMaterial} picking={picking} />

        {showPreview && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-zinc-700">Preview with a test design</h2>
              <div className="flex flex-wrap items-center gap-1.5">
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
                <select
                  value={backdrop}
                  onChange={(e) => setBackdrop(e.target.value)}
                  aria-label="Backdrop"
                  className="ml-1 border border-zinc-200 rounded-md px-2 py-1 text-xs text-zinc-600 bg-white"
                >
                  {BACKDROPS.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <Model3DViewer
              className="h-[480px] w-full rounded-xl overflow-hidden bg-zinc-100"
              glbUrl={resolveImageUrl(draft.glbUrl)}
              printMaterialName={draft.printMaterialName}
              layout={layout}
              designImage={testDesign}
              viewRequest={viewRequest}
              backdrop={backdrop}
              onLoad={() => setLoadStatus('')}
              onError={() => setLoadStatus('The preview could not load this file.')}
            />
            <p className="text-xs text-zinc-500">
              Drag to rotate, scroll to zoom. Check that the pattern continues around the edges without stretching, and that the camera
              and button openings are clear.
            </p>
            {loadStatus && <p className="text-sm text-red-500">{loadStatus}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-600">Phone name</label>
            <input
              type="text"
              value={phoneName}
              onChange={(e) => setPhoneName(e.target.value)}
              placeholder="e.g. iPhone 17 Pro Max"
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

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={!canSave} loading={saving}>
            {saving ? 'Saving...' : editingId ? 'Save changes' : 'Save 3D model'}
          </Button>
          {(editingId || draft) && (
            <Button type="button" variant="secondary" onClick={resetForm} disabled={saving}>
              <X className="w-4 h-4" /> {editingId ? 'Cancel edit' : 'Start over'}
            </Button>
          )}
        </div>
      </form>

      <h2 className="text-sm font-medium text-zinc-600 mb-3">Saved 3D models</h2>
      {loading ? (
        <div className="flex items-center gap-2 text-zinc-400 text-sm py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : models.length === 0 ? (
        <div className="flex flex-col items-center gap-2 text-zinc-400 py-16 border border-dashed border-zinc-200 rounded-xl">
          <Box className="w-6 h-6" />
          <p className="text-sm">No 3D models yet — upload one above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((m) => (
            <div key={m.id} className="bg-white border border-zinc-200 rounded-xl p-3 shadow-sm flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Box className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm text-zinc-900 truncate">{m.phoneName}</div>
                  <div className="text-xs text-zinc-500 truncate">{m.caseType} · 3D</div>
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
          ))}
        </div>
      )}
    </div>
  )
}
