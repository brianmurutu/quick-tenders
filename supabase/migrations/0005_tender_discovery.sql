-- Quick Tenders: support the tender discovery job.
--
-- Two changes, both driven by the discovery runner in
-- app/api/cron/discover-tenders:
--
-- 1. Deduplication. The runner is idempotent by design: it can be re-run at any
--    time and must not create a second row for a tender a company already has.
--    A unique index on (company_id, source_url) makes that a database
--    guarantee rather than something the job has to remember, and gives
--    PostgREST an arbiter index for on_conflict.
--
--    The index is not partial, so rows where either column is null stay
--    distinct. The runner always sets both.
--
-- 2. procuring_entity. The source adapters already return it and it is one of
--    the first things a representative looks for, so keep it rather than
--    folding it into the summary text.

alter table public.tenders_matched
  add column procuring_entity text;

comment on column public.tenders_matched.procuring_entity is
  'Body running the procurement, as reported by the source adapter.';

create unique index tenders_matched_company_id_source_url_key
  on public.tenders_matched (company_id, source_url);

-- The discovery job writes with the service role, which bypasses RLS, so no new
-- policies are needed. Representatives keep the read and write access that 0001
-- granted them on their own rows, procuring_entity included: that column is
-- covered by the table wide grants in 0001, and 0004 only narrowed UPDATE on
-- public.companies, not on public.tenders_matched.
