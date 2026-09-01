import { useEffect, useMemo, useState } from 'react'
import { Check, Download, RotateCcw, Loader2, ImageOff, Search } from 'lucide-react'
import { listHeroModels } from '../api/heroModels'
import { listScenes } from '../api/scenes'
import { generateHero } from '../api/heroGenerations'
import { resolveImageUrl } from '../api/client'
import DesignDropzone from '../components/DesignDropzone'
import Button from '../components/Button'

function StepLabel({ n, children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-5 h-5 rounded-full bg-zinc-900 text-white text-xs font-medium flex items-center justify-center shrink-0">
        {n}
      </span>
      <h2 className="text-sm font-medium text-zinc-900">{children}</h2>
    </div>
  )
}

export default function HeroGenerator() {
  const [models, setModels] = useState([])
  const [scenes, setScenes] = useState([])
  const [loadingModels, setLoadingModels] = useState(true)
  const [modelQuery, setModelQuery] = useState('')
  const [selectedModelId, setSelectedModelId] = useState(null)
  const [selectedSceneId, setSelectedSceneId] = useState(null)
  const [designFile, setDesignFile] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([listHeroModels(), listScenes()])
      .then(([modelsData, scenesData]) => {
        setModels(modelsData)
        setScenes(scenesData)
        const defaultScene = scenesData.find((s) => s.isDefault) ?? scenesData[0]
        if (defaultScene) setSelectedSceneId(defaultScene.id)
      })
      .catch(() => setError('Failed to load models/scenes.'))
      .finally(() => setLoadingModels(false))
  }, [])

  const canGenerate = selectedModelId && selectedSceneId && designFile && !generating

  const filteredModels = useMemo(() => {
    const q = modelQuery.trim().toLowerCase()
    if (!q) return models
    return models.filter((m) =>
      `${m.phoneName} ${m.caseType}`.toLowerCase().includes(q)
    )
  }, [models, modelQuery])

  async function handleGenerate() {
    if (!canGenerate) return
    setGenerating(true)
    setError('')
    try {
      const generation = await generateHero(selectedModelId, designFile, selectedSceneId)
      setResult(generation)
    } catch {
      setError('Generation failed. Try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownload() {
    const url = resolveImageUrl(result.outputImageUrl)
    const res = await fetch(url)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = `hero-${result.id}.png`
    a.click()
    URL.revokeObjectURL(objectUrl)
  }

  function handleReset() {
    setResult(null)
    setDesignFile(null)
  }

  if (result) {
    const selectedModel = models.find((m) => m.id === selectedModelId)
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-900">Your hero photo is ready</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {selectedModel?.phoneName} — {selectedModel?.caseType}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 overflow-hidden bg-zinc-100 shadow-sm">
          <img src={resolveImageUrl(result.outputImageUrl)} alt="Generated hero shot" className="w-full" />
        </div>

        <div className="flex items-center gap-3 mt-5">
          <Button onClick={handleDownload}>
            <Download className="w-4 h-4" /> Download
          </Button>
          <Button variant="secondary" onClick={handleReset}>
            <RotateCcw className="w-4 h-4" /> Generate another
          </Button>
        </div>

        <p className="text-xs text-zinc-400 mt-4 break-all">
          Permanent link: {resolveImageUrl(result.outputImageUrl)}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-900">Hero Shot Generator</h1>
        <p className="text-sm text-zinc-500 mt-1">Pick a phone, a background, upload your design, and generate a studio product photo.</p>
      </div>

      <div className="mb-8">
        <StepLabel n={1}>Choose a phone</StepLabel>
        {loadingModels ? (
          <div className="flex items-center gap-2 text-zinc-400 text-sm py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading models...
          </div>
        ) : models.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-zinc-400 py-10 border border-dashed border-zinc-200 rounded-xl">
            <ImageOff className="w-5 h-5" />
            <p className="text-sm">No phone models yet — add one in Admin first.</p>
          </div>
        ) : (
          <>
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={modelQuery}
                onChange={(e) => setModelQuery(e.target.value)}
                placeholder="Search by phone or case type..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            {filteredModels.length === 0 ? (
              <div className="flex flex-col items-center gap-2 text-zinc-400 py-10 border border-dashed border-zinc-200 rounded-xl">
                <Search className="w-5 h-5" />
                <p className="text-sm">No phone models match "{modelQuery}".</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredModels.map((m) => {
                  const selected = m.id === selectedModelId
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedModelId(m.id)}
                      className={`relative text-left rounded-xl border overflow-hidden transition-all ${
                        selected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <div className="aspect-square bg-zinc-50 flex items-center justify-center p-3">
                        <img src={resolveImageUrl(m.baseImageUrl)} alt="" className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="p-2.5 bg-white">
                        <div className="text-xs font-medium text-zinc-900 truncate">{m.phoneName}</div>
                        <div className="text-xs text-zinc-500 truncate">{m.caseType}</div>
                      </div>
                      {selected && (
                        <div className="absolute top-2 right-2 bg-indigo-600 rounded-full p-0.5">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {scenes.length > 1 && (
        <div className="mb-8">
          <StepLabel n={2}>Choose a background</StepLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {scenes.map((s) => {
              const selected = s.id === selectedSceneId
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedSceneId(s.id)}
                  className={`relative text-left rounded-xl border overflow-hidden transition-all ${
                    selected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <div
                    className="h-14"
                    style={{ background: `linear-gradient(to bottom, ${s.backgroundTopColor}, ${s.backgroundBottomColor})` }}
                  />
                  <div className="p-2.5 bg-white">
                    <div className="text-xs font-medium text-zinc-900 truncate">{s.name}</div>
                  </div>
                  {selected && (
                    <div className="absolute top-2 right-2 bg-indigo-600 rounded-full p-0.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="mb-8">
        <StepLabel n={scenes.length > 1 ? 3 : 2}>Upload your design</StepLabel>
        <DesignDropzone file={designFile} onChange={setDesignFile} />
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <Button onClick={handleGenerate} disabled={!canGenerate} loading={generating} className="w-full py-3">
        {generating ? 'Generating... (usually a few seconds)' : 'Generate'}
      </Button>
    </div>
  )
}
