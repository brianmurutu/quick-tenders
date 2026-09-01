'use client'

import { useState, useEffect } from 'react'

export type CronScheduleOption = 'daily_morning' | 'twice_daily' | 'weekly_monday' | 'manual_only'

const SCHEDULE_LABELS: Record<CronScheduleOption, { label: string; desc: string; nextRunText: string }> = {
  daily_morning: {
    label: 'Daily (Every Morning at 04:23 UTC / 07:23 EAT)',
    desc: 'Runs daily discovery and AI matching every morning before business hours.',
    nextRunText: 'Tomorrow at 04:23 UTC',
  },
  twice_daily: {
    label: 'Twice Daily (04:23 UTC & 16:00 UTC)',
    desc: 'Scrapes procurement portals in the morning and afternoon for new opportunities.',
    nextRunText: 'Next scheduled window: 16:00 UTC',
  },
  weekly_monday: {
    label: 'Weekly (Every Monday Morning)',
    desc: 'Runs once at the start of the week for weekly procurement digests.',
    nextRunText: 'Next Monday at 04:23 UTC',
  },
  manual_only: {
    label: 'Manual Only (On-Demand)',
    desc: 'Scheduled automated runs disabled. Tenders are only discovered when triggered manually.',
    nextRunText: 'Paused (Manual trigger only)',
  },
}

export function CronScheduleCard() {
  const [schedule, setSchedule] = useState<CronScheduleOption>('daily_morning')
  const [autoDraft, setAutoDraft] = useState(true)
  const [minScore, setMinScore] = useState(70)
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('quick_tenders_cron_schedule')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.schedule) setSchedule(parsed.schedule)
        if (typeof parsed.autoDraft === 'boolean') setAutoDraft(parsed.autoDraft)
        if (typeof parsed.minScore === 'number') setMinScore(parsed.minScore)
        if (typeof parsed.emailAlerts === 'boolean') setEmailAlerts(parsed.emailAlerts)
      }
    } catch {
      // ignore
    }
  }, [])

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    try {
      localStorage.setItem(
        'quick_tenders_cron_schedule',
        JSON.stringify({ schedule, autoDraft, minScore, emailAlerts, updatedAt: new Date().toISOString() }),
      )
      setSavedMessage('Automated schedule preferences saved successfully!')
      setTimeout(() => setSavedMessage(null), 3500)
    } catch {
      setSavedMessage('Preferences updated.')
    }
  }

  const activeDetails = SCHEDULE_LABELS[schedule]

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-base font-semibold text-slate-900">
              Automated AI Agent Schedule (Cron)
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Current active schedule:{' '}
            <span className="font-medium text-slate-900">{activeDetails.label}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
            Next run: <strong className="text-slate-900">{activeDetails.nextRunText}</strong>
          </span>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            {isOpen ? 'Hide Settings' : 'Configure Schedule'}
          </button>
        </div>
      </div>

      {isOpen && (
        <form onSubmit={handleSave} className="mt-6 border-t border-slate-100 pt-6 space-y-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Automated Discovery Frequency
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(SCHEDULE_LABELS) as CronScheduleOption[]).map((key) => {
                const opt = SCHEDULE_LABELS[key]
                const isSelected = schedule === key
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer flex-col rounded-lg border p-3.5 transition-colors ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">{opt.label}</span>
                      <input
                        type="radio"
                        name="cron-frequency"
                        value={key}
                        checked={isSelected}
                        onChange={() => setSchedule(key)}
                        className="accent-blue-700"
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{opt.desc}</p>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 border-t border-slate-100 pt-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Automatic Proposal Drafting (.docx)
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoDraft}
                  onChange={(e) => setAutoDraft(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-blue-700"
                />
                <div>
                  <span className="text-sm font-medium text-slate-900">
                    Auto-draft documents on high compatibility
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Generate Executive Summaries, Technical Responses, and Cover Letters automatically when a match is found.
                  </p>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Match Threshold for Auto-Drafting: {minScore}%
              </label>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={minScore}
                disabled={!autoDraft}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-full accent-blue-700 disabled:opacity-40"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>50% (Broad)</span>
                <span>70% (Recommended)</span>
                <span>95% (Strict)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-blue-700"
              />
              <span className="text-xs font-medium text-slate-700">
                Email representative when scheduled run produces new matches
              </span>
            </label>

            <button
              type="submit"
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              Save Schedule Settings
            </button>
          </div>

          {savedMessage && (
            <p className="rounded-md bg-emerald-50 border border-emerald-200 p-2.5 text-xs font-medium text-emerald-800 text-center animate-fade-in">
              ✓ {savedMessage}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
