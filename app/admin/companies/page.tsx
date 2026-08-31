import type { Metadata } from 'next'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Companies | Admin | Quick Tenders',
}

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25

type SortKey = 'name' | 'domain' | 'plan' | 'trial_ends_at' | 'created_at'
type SortDir = 'asc' | 'desc'

const VALID_SORT_KEYS: SortKey[] = ['name', 'domain', 'plan', 'trial_ends_at', 'created_at']

function parseSort(raw: string | undefined): SortKey {
  return VALID_SORT_KEYS.includes(raw as SortKey) ? (raw as SortKey) : 'created_at'
}

function parseDir(raw: string | undefined): SortDir {
  return raw === 'asc' ? 'asc' : 'desc'
}

function parsePage(raw: string | undefined): number {
  const n = parseInt(raw ?? '1', 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function trialStatusLabel(
  plan: string,
  trialEndsAt: string,
): { label: string; className: string } {
  if (plan !== 'trial') {
    return { label: 'Paid', className: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' }
  }

  const msRemaining = new Date(trialEndsAt).getTime() - Date.now()

  if (msRemaining <= 0) {
    return { label: 'Expired', className: 'bg-red-50 text-red-800 ring-1 ring-red-200' }
  }

  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000))
  return {
    label: `${daysRemaining}d left`,
    className: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  }
}

function SortLink({
  col,
  label,
  current,
  dir,
  q,
}: {
  col: SortKey
  label: string
  current: SortKey
  dir: SortDir
  q: string
}) {
  const isActive = col === current
  const nextDir = isActive && dir === 'asc' ? 'desc' : 'asc'
  const params = new URLSearchParams({
    ...(q ? { q } : {}),
    sort: col,
    dir: nextDir,
    page: '1',
  })

  return (
    <Link
      href={`/admin/companies?${params}`}
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
        isActive ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'
      }`}
    >
      {label}
      {isActive ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: {
    q?: string
    sort?: string
    dir?: string
    page?: string
  }
}) {
  const supabase = createClient()

  const q = searchParams.q?.trim() ?? ''
  const sort = parseSort(searchParams.sort)
  const dir = parseDir(searchParams.dir)
  const page = parsePage(searchParams.page)
  const offset = (page - 1) * PAGE_SIZE

  // We need a tenders_matched count per company. PostgREST supports an
  // aggregate select via embedding: select companies + count of tenders_matched.
  // The syntax is: .select('*, tenders_matched(count)')
  // This works when there is a FK relationship defined in types/database.ts.
  // Since tenders_matched references companies, PostgREST resolves it.
  let query = supabase
    .from('companies')
    .select('id, name, domain, industry, region, plan, trial_ends_at, created_at, tenders_matched(count)', {
      count: 'exact',
    })

  if (q) {
    query = query.or(`name.ilike.%${q}%,domain.ilike.%${q}%`)
  }

  // Sort
  query = query.order(sort, { ascending: dir === 'asc', nullsFirst: false })

  // Pagination
  query = query.range(offset, offset + PAGE_SIZE - 1)

  const { data, count, error } = await query

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1

  // Serialise tenders_matched count from the embedded array shape.
  type CompanyRow = {
    id: string
    name: string | null
    domain: string
    industry: string | null
    region: string | null
    plan: string
    trial_ends_at: string
    created_at: string
    tenders_matched: { count: number }[] | null
  }

  const companies = (data as CompanyRow[] | null) ?? []

  function tendersCount(row: CompanyRow): number {
    const first = row.tenders_matched?.[0]
    return typeof first === 'object' && first !== null && 'count' in first
      ? (first as { count: number }).count
      : 0
  }

  // Build URL helpers for pagination.
  function pageUrl(p: number): string {
    const params = new URLSearchParams({
      ...(q ? { q } : {}),
      sort,
      dir,
      page: String(p),
    })
    return `/admin/companies?${params}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Companies</h1>
        <p className="mt-1 text-sm text-slate-500">
          {count ?? 0} company{count !== 1 ? 'ies' : 'y'} total.
        </p>
      </div>

      {/* Search form — GET, so search is bookmarkable and sharable. */}
      <form method="GET" action="/admin/companies" className="flex gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name or domain…"
          className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {/* Preserve sort/dir when searching */}
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <button
          type="submit"
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Search
        </button>
        {q ? (
          <Link
            href="/admin/companies"
            className="flex items-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          Could not load companies: {error.message}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="py-3 pr-3 pl-5">
                    <SortLink col="name" label="Name" current={sort} dir={dir} q={q} />
                  </th>
                  <th className="py-3 pr-3">
                    <SortLink col="domain" label="Domain" current={sort} dir={dir} q={q} />
                  </th>
                  <th className="py-3 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Industry
                  </th>
                  <th className="py-3 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Region
                  </th>
                  <th className="py-3 pr-3">
                    <SortLink col="plan" label="Plan" current={sort} dir={dir} q={q} />
                  </th>
                  <th className="py-3 pr-3">
                    <SortLink col="trial_ends_at" label="Trial" current={sort} dir={dir} q={q} />
                  </th>
                  <th className="py-3 pr-5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Tenders
                  </th>
                </tr>
              </thead>
              <tbody>
                {companies.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-slate-400">
                      {q ? `No companies match "${q}".` : 'No companies yet.'}
                    </td>
                  </tr>
                ) : (
                  companies.map((company) => {
                    const trial = trialStatusLabel(company.plan, company.trial_ends_at)
                    return (
                      <tr
                        key={company.id}
                        className="border-t border-slate-100 transition-colors hover:bg-slate-50"
                      >
                        <td className="py-3 pr-3 pl-5 font-medium text-slate-900">
                          <Link
                            href={`/admin/companies/${company.id}`}
                            className="hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                          >
                            {company.name ?? <span className="text-slate-400 italic">Unnamed</span>}
                          </Link>
                        </td>
                        <td className="py-3 pr-3 text-slate-600">{company.domain}</td>
                        <td className="py-3 pr-3 text-slate-500">{company.industry ?? '—'}</td>
                        <td className="py-3 pr-3 text-slate-500">{company.region ?? '—'}</td>
                        <td className="py-3 pr-3 capitalize text-slate-700">{company.plan}</td>
                        <td className="py-3 pr-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${trial.className}`}
                          >
                            {trial.label}
                          </span>
                        </td>
                        <td className="py-3 pr-5 text-right tabular-nums text-slate-700">
                          {tendersCount(company)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 ? (
            <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
              <p className="text-slate-500">
                Page {page} of {totalPages} ({count} companies)
              </p>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link
                    href={pageUrl(page - 1)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    ← Previous
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link
                    href={pageUrl(page + 1)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Next →
                  </Link>
                ) : null}
              </div>
            </nav>
          ) : null}
        </>
      )}
    </div>
  )
}
