'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { SECTORS } from '@/lib/company-profile'
import {
  triggerDiscoveryAction,
  triggerDraftingAction,
  triggerFullPipelineAction,
  triggerResetMatchesAction,
  updateRepresentativePhoneAction,
} from './automation-actions'

type TriggerMode = 'idle' | 'discovery' | 'drafting' | 'full' | 'resetting'

export function AutomationTrigger({
  initialMatchedCount,
  companyProfileSectors = [],
  representativePhone,
  representativeEmail,
}: {
  initialMatchedCount: number
  companyProfileSectors?: string[]
  representativePhone?: string | null
  representativeEmail?: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeAction, setActiveAction] = useState<TriggerMode>('idle')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState<number>(0)

  // Sector selection state
  const [showSectorPicker, setShowSectorPicker] = useState(false)
  const [selectedSectors, setSelectedSectors] = useState<string[]>(
    companyProfileSectors.length > 0
      ? companyProfileSectors
      : ['ICT and software', 'Building and construction', 'Telecommunications'],
  )
  const [forceRescore, setForceRescore] = useState(false)

  // Phone editing state
  const [phone, setPhone] = useState(representativePhone ?? '')
  const [isEditingPhone, setIsEditingPhone] = useState(false)
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [phoneFeedback, setPhoneFeedback] = useState<string | null>(null)

  const [lastSummary, setLastSummary] = useState<{
    type: 'success' | 'error' | 'info'
    title: string
    details: string
    matchedCount?: number
    topScore?: number | null
  } | null>(null)

  const busy = isPending || activeAction !== 'idle'

  function toggleSector(sector: string) {
    setSelectedSectors((prev) =>
      prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector],
    )
  }

  function handleSelectAll() {
    setSelectedSectors([...SECTORS])
  }

  function handleClearAll() {
    setSelectedSectors([])
  }

  function handleResetProfile() {
    setSelectedSectors(companyProfileSectors.length > 0 ? companyProfileSectors : ['ICT and software'])
  }

  async function handleSavePhone(e: React.FormEvent) {
    e.preventDefault()
    setPhoneSaving(true)
    setPhoneFeedback(null)
    try {
      const res = await updateRepresentativePhoneAction(phone)
      if (res.ok) {
        setPhoneFeedback('✓ Phone saved for SMS alerts')
        setIsEditingPhone(false)
        router.refresh()
      } else {
        setPhoneFeedback(`Error: ${res.message}`)
      }
    } catch (err) {
      setPhoneFeedback('Failed to update phone.')
    } finally {
      setPhoneSaving(false)
      setTimeout(() => setPhoneFeedback(null), 4000)
    }
  }

  function handleRunDiscovery() {
    setActiveAction('discovery')
    setActiveStep(1)
    setStatusMessage('1/3 Connecting to procurement portals (GAA, TendersInfo, Tenders Kenya)...')
    setLastSummary(null)

    startTransition(async () => {
      try {
        setTimeout(() => {
          setActiveStep(2)
          setStatusMessage('2/3 Scoring tender relevance with AI across selected sectors...')
        }, 1200)

        const res = await triggerDiscoveryAction({
          customSectors: selectedSectors,
          forceRescore,
        })

        setActiveStep(3)
        setStatusMessage('3/3 Dispatched notifications via Email & SMS...')

        if (res.ok) {
          setLastSummary({
            type: 'success',
            title: 'Discovery & Matching Completed',
            details: res.message,
            matchedCount: res.matchedCount,
            topScore: res.topScore,
          })
          setStatusMessage(null)
          router.refresh()
        } else {
          setLastSummary({
            type: 'error',
            title: 'Discovery Run Failed',
            details: res.error,
          })
          setStatusMessage(null)
        }
      } catch (err) {
        setLastSummary({
          type: 'error',
          title: 'Error Triggering Automation',
          details: err instanceof Error ? err.message : 'Unknown error',
        })
        setStatusMessage(null)
      } finally {
        setActiveAction('idle')
        setActiveStep(0)
      }
    })
  }

  function handleRunDrafting() {
    setActiveAction('drafting')
    setStatusMessage('Generating Word (.docx) technical proposals and bid documents with AI...')
    setLastSummary(null)

    startTransition(async () => {
      try {
        const res = await triggerDraftingAction()
        if (res.ok) {
          setLastSummary({
            type: 'success',
            title: 'AI Drafting Completed',
            details: res.message,
          })
          setStatusMessage(null)
          router.refresh()
        } else {
          setLastSummary({
            type: 'error',
            title: 'Drafting Failed',
            details: res.error,
          })
          setStatusMessage(null)
        }
      } catch (err) {
        setLastSummary({
          type: 'error',
          title: 'Error',
          details: err instanceof Error ? err.message : 'Unknown error',
        })
        setStatusMessage(null)
      } finally {
        setActiveAction('idle')
      }
    })
  }

  function handleRunFullPipeline() {
    setActiveAction('full')
    setActiveStep(1)
    setStatusMessage('1/3 Scraping portals & scoring tenders for selected sectors...')
    setLastSummary(null)

    startTransition(async () => {
      try {
        setTimeout(() => {
          setActiveStep(2)
          setStatusMessage('2/3 Drafting compliant proposals and bid documents with AI...')
        }, 2000)

        const res = await triggerFullPipelineAction({
          customSectors: selectedSectors,
          forceRescore,
        })

        setActiveStep(3)
        setStatusMessage('3/3 Dispatched tender documents and alerts via Email & SMS...')

        if (res.ok) {
          setLastSummary({
            type: 'success',
            title: 'Full Pipeline Run Successful',
            details: res.message,
            matchedCount: res.matchedCount,
          })
          setStatusMessage(null)
          router.refresh()
        } else {
          setLastSummary({
            type: 'error',
            title: 'Pipeline Run Failed',
            details: res.error,
          })
          setStatusMessage(null)
        }
      } catch (err) {
        setLastSummary({
          type: 'error',
          title: 'Error',
          details: err instanceof Error ? err.message : 'Unknown error',
        })
        setStatusMessage(null)
      } finally {
        setActiveAction('idle')
        setActiveStep(0)
      }
    })
  }

  function handleReset() {
    if (!confirm('Are you sure you want to clear current matched tenders for a fresh demo run?')) {
      return
    }

    setActiveAction('resetting')
    setStatusMessage('Resetting dashboard tenders...')
    setLastSummary(null)

    startTransition(async () => {
      try {
        const res = await triggerResetMatchesAction()
        setLastSummary({
          type: 'info',
          title: 'Reset Completed',
          details: res.message,
        })
        setStatusMessage(null)
        router.refresh()
      } catch (err) {
        setLastSummary({
          type: 'error',
          title: 'Reset Failed',
          details: err instanceof Error ? err.message : 'Unknown error',
        })
        setStatusMessage(null)
      } finally {
        setActiveAction('idle')
      }
    })
  }

  return (
    <div className="mt-6 rounded-2xl border border-blue-200/90 bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white p-6 shadow-sm transition-all">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white shadow-sm ring-4 ring-blue-100">
            <SparklesIcon />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-slate-900">
                Interactive AI Discovery & Matching
              </h2>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-emerald-800">
                Live Engine
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              Trigger on-demand runs with custom sectors, automated AI scoring, proposal drafting, and immediate Email & SMS notifications.
            </p>
          </div>
        </div>

        {/* Sector Picker Toggle Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSectorPicker(!showSectorPicker)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <span>🎯 Custom Sectors ({selectedSectors.length} active)</span>
            <span className="text-slate-400 text-[10px]">{showSectorPicker ? '▲' : '▼'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Sector Selection Panel */}
      {showSectorPicker && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition-all">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                Select Sectors for Next Run
              </h3>
              <p className="text-[11px] text-slate-500">
                Choose the exact procurement categories you want the AI agent to prioritize.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] font-semibold text-blue-700 hover:underline"
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[11px] font-semibold text-slate-600 hover:underline"
              >
                Clear All
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={handleResetProfile}
                className="text-[11px] font-semibold text-slate-600 hover:underline"
              >
                Reset to Profile
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1">
            {SECTORS.map((sector) => {
              const selected = selectedSectors.includes(sector)
              return (
                <button
                  key={sector}
                  type="button"
                  onClick={() => toggleSector(sector)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    selected
                      ? 'bg-blue-700 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{selected ? '✓' : '+'}</span>
                  <span>{sector}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700">
              <input
                type="checkbox"
                checked={forceRescore}
                onChange={(e) => setForceRescore(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-[11px]">Force rescore all open tenders (including previously viewed)</span>
            </label>
            <span className="text-[11px] text-slate-500">
              {selectedSectors.length} of {SECTORS.length} sectors active
            </span>
          </div>
        </div>
      )}

      {/* Notification Channel Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white/70 px-4 py-2.5 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-600">✉️</span>
            <span>Email alerts:</span>
            <strong className="text-slate-800">{representativeEmail || 'Configured'}</strong>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-blue-600">📱</span>
            <span>SMS alerts:</span>
            {isEditingPhone ? (
              <form onSubmit={handleSavePhone} className="inline-flex items-center gap-1.5">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0712623941"
                  className="w-32 rounded border border-slate-300 px-2 py-0.5 text-xs focus:border-blue-500 focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={phoneSaving}
                  className="rounded bg-blue-700 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-blue-800"
                >
                  {phoneSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(false)}
                  className="text-[11px] text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <strong className="text-slate-800">{phone || 'Not set'}</strong>
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(true)}
                  className="text-[11px] font-medium text-blue-700 hover:underline"
                >
                  Edit
                </button>
              </>
            )}
            {phoneFeedback && (
              <span className="ml-1 text-[11px] font-semibold text-emerald-700">
                {phoneFeedback}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Notifications on match & no-match active</span>
        </div>
      </div>

      {/* Actions Toolbar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Custom Discovery Button */}
          <button
            type="button"
            onClick={handleRunDiscovery}
            disabled={busy || selectedSectors.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {activeAction === 'discovery' ? (
              <>
                <SpinnerIcon />
                <span>Running Discovery…</span>
              </>
            ) : (
              <>
                <SearchIcon />
                <span>Find & Match Tenders ({selectedSectors.length} Sectors)</span>
              </>
            )}
          </button>

          {/* Full Pipeline Button */}
          <button
            type="button"
            onClick={handleRunFullPipeline}
            disabled={busy || selectedSectors.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-3.5 py-2 text-xs font-semibold text-blue-800 shadow-2xs hover:bg-blue-50 transition-all disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activeAction === 'full' ? (
              <>
                <SpinnerIcon />
                <span>Executing Pipeline…</span>
              </>
            ) : (
              <>
                <RocketIcon />
                <span>Full Pipeline (Discovery + Proposal Drafts)</span>
              </>
            )}
          </button>

          {/* Auto-Draft Proposals */}
          <button
            type="button"
            onClick={handleRunDrafting}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-all disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activeAction === 'drafting' ? (
              <>
                <SpinnerIcon />
                <span>Drafting Proposals…</span>
              </>
            ) : (
              <>
                <DocumentTextIcon />
                <span>Auto-Draft Proposals (.docx)</span>
              </>
            )}
          </button>
        </div>

        {/* Reset Demo Button */}
        {initialMatchedCount > 0 && (
          <button
            type="button"
            onClick={handleReset}
            disabled={busy}
            title="Clear matches to test discovery from an empty state"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <RefreshIcon />
            <span>Reset Demo</span>
          </button>
        )}
      </div>

      {/* Progress / Step Visualizer */}
      {statusMessage && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/90 p-3.5 text-xs text-blue-950">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 font-medium">
              <SpinnerIcon />
              <span>{statusMessage}</span>
            </div>
            <span className="text-[11px] font-bold text-blue-700">In Progress</span>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <div
              className={`h-1.5 rounded-full transition-all ${
                activeStep >= 1 ? 'bg-blue-600' : 'bg-blue-200'
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all ${
                activeStep >= 2 ? 'bg-blue-600' : 'bg-blue-200'
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all ${
                activeStep >= 3 ? 'bg-blue-600' : 'bg-blue-200'
              }`}
            />
          </div>
        </div>
      )}

      {/* Summary Output Box */}
      {lastSummary && (
        <div
          className={`mt-4 rounded-xl border p-4 text-xs leading-relaxed transition-all shadow-2xs ${
            lastSummary.type === 'success'
              ? 'border-emerald-300 bg-emerald-50/90 text-emerald-950'
              : lastSummary.type === 'error'
                ? 'border-rose-300 bg-rose-50/90 text-rose-950'
                : 'border-slate-300 bg-slate-50 text-slate-900'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold flex items-center gap-1.5 text-sm">
                <span>{lastSummary.type === 'success' ? '✅' : lastSummary.type === 'error' ? '❌' : 'ℹ️'}</span>
                {lastSummary.title}
              </p>
              <p className="mt-1 text-slate-700">{lastSummary.details}</p>
              {typeof lastSummary.topScore === 'number' && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-800 border border-slate-200">
                  <span>Top Match Compatibility:</span>
                  <span className="text-blue-700 font-bold">{lastSummary.topScore}%</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setLastSummary(null)}
              className="text-slate-400 hover:text-slate-600 text-sm font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SparklesIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  )
}

function RocketIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="8" cy="8" r="5" />
      <path strokeLinecap="round" d="m12 12 4 4" />
    </svg>
  )
}

function DocumentTextIcon() {
  return (
    <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}
