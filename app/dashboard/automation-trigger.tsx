'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import {
  triggerDiscoveryAction,
  triggerDraftingAction,
  triggerFullPipelineAction,
  triggerResetMatchesAction,
} from './automation-actions'

type TriggerMode = 'idle' | 'discovery' | 'drafting' | 'full' | 'resetting'

export function AutomationTrigger({ initialMatchedCount }: { initialMatchedCount: number }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeAction, setActiveAction] = useState<TriggerMode>('idle')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [lastSummary, setLastSummary] = useState<{
    type: 'success' | 'error' | 'info'
    title: string
    details: string
  } | null>(null)

  const busy = isPending || activeAction !== 'idle'

  function handleRunDiscovery() {
    setActiveAction('discovery')
    setStatusMessage('Connecting to procurement sources and scoring with AI...')
    setLastSummary(null)

    startTransition(async () => {
      try {
        const res = await triggerDiscoveryAction()
        if (res.ok) {
          setLastSummary({
            type: 'success',
            title: 'Discovery & Matching Completed',
            details: res.message,
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
    setStatusMessage('Running end-to-end automation: Discovery ➔ Scoring ➔ Proposal Drafting...')
    setLastSummary(null)

    startTransition(async () => {
      try {
        const res = await triggerFullPipelineAction()
        if (res.ok) {
          setLastSummary({
            type: 'success',
            title: 'Full Pipeline Run Successful',
            details: res.message,
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
    <div className="mt-6 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white p-5 shadow-xs transition-all">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-white shadow-xs">
            <SparklesIcon />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-slate-900">
                Agent Automation Triggers
              </h2>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase text-blue-800">
                Live Controls
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              Run tender discovery, AI matching, and proposal drafting on-demand without waiting for
              cron schedules.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Main On-Demand Triggers */}
          <button
            type="button"
            onClick={handleRunFullPipeline}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {activeAction === 'full' ? (
              <>
                <SpinnerIcon />
                <span>Running Full Pipeline…</span>
              </>
            ) : (
              <>
                <RocketIcon />
                <span>Run Full Automation</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleRunDiscovery}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activeAction === 'discovery' ? (
              <>
                <SpinnerIcon />
                <span>Discovering…</span>
              </>
            ) : (
              <>
                <SearchIcon />
                <span>Find & Match Tenders</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleRunDrafting}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activeAction === 'drafting' ? (
              <>
                <SpinnerIcon />
                <span>Drafting Documents…</span>
              </>
            ) : (
              <>
                <DocumentTextIcon />
                <span>Auto-Draft Proposals</span>
              </>
            )}
          </button>

          {/* Reset Demo Button */}
          {initialMatchedCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              disabled={busy}
              title="Clear matches to demonstrate matching from empty state"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            >
              <RefreshIcon />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-time Progress Bar / Status */}
      {statusMessage && (
        <div className="mt-3.5 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-100/60 px-4 py-2.5 text-xs font-medium text-blue-900 animate-pulse">
          <SpinnerIcon />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Output / Summary Box */}
      {lastSummary && (
        <div
          className={`mt-3.5 rounded-lg border px-4 py-3 text-xs leading-relaxed transition-all ${
            lastSummary.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : lastSummary.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-900'
                : 'border-slate-200 bg-slate-50 text-slate-800'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold flex items-center gap-1.5">
                <span>{lastSummary.type === 'success' ? '✅' : lastSummary.type === 'error' ? '❌' : 'ℹ️'}</span>
                {lastSummary.title}
              </p>
              <p className="mt-1 text-slate-700">{lastSummary.details}</p>
            </div>
            <button
              type="button"
              onClick={() => setLastSummary(null)}
              className="text-slate-400 hover:text-slate-600"
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
    <svg className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
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
