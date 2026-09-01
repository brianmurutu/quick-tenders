import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { formatTrialDate, trialState } from '@/lib/trial'

import { ExtendTrialForm, SetPlanForm, ResendRepAuthButton } from './admin-action-forms'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient()
  const { data } = await supabase
    .from('companies')
    .select('name, domain')
    .eq('id', params.id)
    .maybeSingle()

  return {
    title: data ? `${data.name ?? data.domain} | Admin | Quick Tenders` : 'Company | Admin',
  }
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

async function fetchCompanyDetail(id: string) {
  const supabase = createClient()

  const [companyResult, tendersResult, repResult] = await Promise.all([
    supabase
      .from('companies')
      .select(
        'id, name, domain, industry, sectors_of_interest, region, company_size, plan, trial_started_at, trial_ends_at, created_at',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('tenders_matched')
      .select('id, title, procuring_entity, deadline, match_score, status, created_at')
      .eq('company_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('representatives')
      .select('id, full_name, email, created_at')
      .eq('company_id', id)
      .order('created_at', { ascending: true }),
  ])

  return {
    company: companyResult.data,
    tenders: tendersResult.data ?? [],
    representatives: repResult.data ?? [],
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  reviewed: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  submitted: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  expired: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">{title}</h2>
      {children}
    </section>
  )
}

function ProfileField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{value ?? '—'}</dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminCompanyDetailPage({ params }: { params: { id: string } }) {
  const { company, tenders, representatives } = await fetchCompanyDetail(params.id)

  if (!company) notFound()

  const trial = trialState(company)

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/companies"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        ← Companies
      </Link>

      {/* Heading */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {company.name ?? <span className="text-slate-400 italic">Unnamed company</span>}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{company.domain}</p>
        </div>
        <span
          className={`mt-1 shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
            company.plan === 'paid'
              ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
              : trial.expired
                ? 'bg-red-50 text-red-800 ring-1 ring-red-200'
                : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
          }`}
        >
          {company.plan === 'paid'
            ? 'Paid'
            : trial.expired
              ? 'Trial expired'
              : `Trial — ${trial.daysRemaining}d left`}
        </span>
      </div>

      {/* Company profile */}
      <Section title="Company profile">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
          <ProfileField label="Name" value={company.name} />
          <ProfileField label="Domain" value={company.domain} />
          <ProfileField label="Industry" value={company.industry} />
          <ProfileField label="Region" value={company.region} />
          <ProfileField label="Company size" value={company.company_size} />
          <ProfileField label="Plan" value={company.plan} />
          <ProfileField label="Trial started" value={formatDate(company.trial_started_at)} />
          <ProfileField
            label="Trial ends"
            value={trial.endsAt ? formatTrialDate(trial.endsAt) : formatDate(company.trial_ends_at)}
          />
          <ProfileField label="Signed up" value={formatDate(company.created_at)} />
          {company.sectors_of_interest?.length ? (
            <div className="col-span-full">
              <dt className="text-xs text-slate-500">Sectors of interest</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {company.sectors_of_interest.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700"
                  >
                    {s}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      </Section>

      {/* Representatives */}
      <Section title={`Representatives (${representatives.length})`}>
        {representatives.length === 0 ? (
          <p className="text-sm text-slate-400">No representatives yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {representatives.map((rep) => (
              <li key={rep.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{rep.full_name ?? '—'}</p>
                  <p className="text-xs text-slate-500">{rep.email}</p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-xs text-slate-400">Joined {formatDate(rep.created_at)}</p>
                  <ResendRepAuthButton email={rep.email} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Admin actions */}
      <Section title="Admin actions">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-900">Extend trial</p>
            <p className="mb-4 text-xs leading-relaxed text-slate-500">
              Pushes trial_ends_at out from today or the current end date, whichever is later.
              Has no effect if the plan is already &ldquo;paid&rdquo;.
            </p>
            <ExtendTrialForm companyId={company.id} currentEndsAt={company.trial_ends_at} />
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-slate-900">Set plan</p>
            <p className="mb-4 text-xs leading-relaxed text-slate-500">
              Changing to &ldquo;paid&rdquo; grants unlimited access immediately.
              Changing back to &ldquo;trial&rdquo; re-enables the trial window gate.
            </p>
            <SetPlanForm companyId={company.id} currentPlan={company.plan} />
          </div>
        </div>
      </Section>

      {/* Matched tenders */}
      <Section title={`Matched tenders (${tenders.length})`}>
        {tenders.length === 0 ? (
          <p className="text-sm text-slate-400">No tenders matched yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="py-2 pr-3 pl-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Title
                  </th>
                  <th className="py-2 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Entity
                  </th>
                  <th className="py-2 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Deadline
                  </th>
                  <th className="py-2 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Score
                  </th>
                  <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {tenders.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="py-2.5 pr-3 pl-4 font-medium text-slate-900">
                      {t.title ?? <span className="italic text-slate-400">Untitled</span>}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">
                      {t.procuring_entity ?? '—'}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-slate-600">
                      {formatDate(t.deadline)}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-slate-600">
                      {t.match_score !== null ? `${Math.round(t.match_score * 100)}%` : '—'}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[t.status] ?? ''}`}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}
