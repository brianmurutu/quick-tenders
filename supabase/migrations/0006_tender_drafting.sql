-- Quick Tenders: bid document drafting and notification.
--
-- Supports app/api/cron/draft-documents, which drafts a cover letter and a
-- technical proposal skeleton for each new match, stores them, and emails the
-- representative.

-- ---------------------------------------------------------------------------
-- Notification state
-- ---------------------------------------------------------------------------
--
-- Without this the job cannot tell "documents drafted and emailed" from
-- "documents drafted, email failed". The pending query keys off documents AND
-- this column, so a tender whose email bounced is retried on the next run
-- instead of going quiet forever.

alter table public.tenders_matched
  add column notified_at timestamptz;

comment on column public.tenders_matched.notified_at is
  'When the representative was emailed about this match. Null means not yet, and the drafting job will retry.';

-- ---------------------------------------------------------------------------
-- One document of each type per tender
-- ---------------------------------------------------------------------------
--
-- Makes the drafting job idempotent at the database level: a retry after a
-- partial failure cannot leave two cover letters attached to one tender.

create unique index tender_documents_tender_id_doc_type_key
  on public.tender_documents (tender_id, doc_type);

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
--
-- Private bucket. These are draft bid documents, which are commercially
-- sensitive: a competitor holding one would know the pricing approach and the
-- technical response before the deadline.
--
-- Object naming is company_id/tender_id/doc_type.docx, so the first path
-- segment is the tenancy key and the read policy can check it directly.

insert into storage.buckets (id, name, public)
values ('tender-documents', 'tender-documents', false)
on conflict (id) do nothing;

-- Representatives may read their own company documents and nothing else.
create policy tender_documents_read_own_company
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'tender-documents'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

-- No insert, update or delete policy for authenticated on purpose. The drafting
-- job writes with the service role, and a representative has no reason to be
-- able to replace a generated document in place. They download, edit locally and
-- submit.

-- ---------------------------------------------------------------------------
-- The work queue
-- ---------------------------------------------------------------------------
--
-- Returns matches that still need drafting or notifying, with the company
-- profile and representative contacts already joined on, so the job makes one
-- round trip instead of one per tender.
--
-- Tenders whose deadline has passed are excluded: there is no point paying to
-- draft a bid for a closed tender.

create or replace function public.pending_tender_drafts(p_limit integer default 25)
returns table (
  tender_id            uuid,
  title                text,
  source_url           text,
  deadline             date,
  summary              text,
  match_score          numeric,
  procuring_entity     text,
  notified_at          timestamptz,
  document_count       bigint,
  company_id           uuid,
  company_name         text,
  industry             text,
  sectors_of_interest  text[],
  region               text,
  company_size         text,
  representative_name  text,
  representative_emails text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id,
    t.title,
    t.source_url,
    t.deadline,
    t.summary,
    t.match_score,
    t.procuring_entity,
    t.notified_at,
    coalesce(d.document_count, 0),
    c.id,
    c.name,
    c.industry,
    c.sectors_of_interest,
    c.region,
    c.company_size,
    reps.representative_name,
    reps.representative_emails
  from public.tenders_matched t
  join public.companies c on c.id = t.company_id
  left join (
    select td.tender_id, count(*) as document_count
    from public.tender_documents td
    group by td.tender_id
  ) d on d.tender_id = t.id
  left join lateral (
    select
      (array_agg(r.full_name order by r.created_at, r.email))[1] as representative_name,
      array_agg(r.email order by r.created_at, r.email) as representative_emails
    from public.representatives r
    where r.company_id = c.id
  ) reps on true
  where (coalesce(d.document_count, 0) = 0 or t.notified_at is null)
    and (t.deadline is null or t.deadline >= current_date)
  order by t.match_score desc nulls last, t.created_at
  limit greatest(1, least(coalesce(p_limit, 25), 200));
$$;

comment on function public.pending_tender_drafts(integer) is
  'Matches still needing documents or a notification, with company profile and representative contacts joined on. Service role only.';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
--
-- Explicit rather than relying on Supabase default privileges, matching the
-- style of 0001. The drafting job runs as service_role.

grant select, insert, update, delete on public.tenders_matched  to service_role;
grant select, insert, update, delete on public.tender_documents to service_role;
grant select                          on public.companies       to service_role;
grant select                          on public.representatives to service_role;

revoke execute on function public.pending_tender_drafts(integer) from public;

-- Deliberately NOT granted to authenticated: it reads across every tenant.
grant execute on function public.pending_tender_drafts(integer) to service_role;
