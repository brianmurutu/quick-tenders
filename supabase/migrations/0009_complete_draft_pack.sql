-- Keep the drafting queue open until every promised bid-pack document exists.
-- This also requeues older tenders that already received only the original
-- cover letter and technical proposal.

alter table public.tenders_matched
  add column source_description text;

drop function public.pending_tender_drafts(integer);

create function public.pending_tender_drafts(p_limit integer default 25)
returns table (
  tender_id             uuid,
  title                 text,
  source_url            text,
  deadline              date,
  summary               text,
  source_description    text,
  match_score           numeric,
  procuring_entity      text,
  notified_at           timestamptz,
  document_count        bigint,
  company_id            uuid,
  company_name          text,
  industry              text,
  sectors_of_interest   text[],
  region                text,
  company_size          text,
  representative_name   text,
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
    t.source_description,
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
  where (
      t.notified_at is null
      or exists (
        select 1
        from unnest(array[
          'cover_letter',
          'form_of_tender',
          'technical_proposal',
          'priced_bill_of_quantities',
          'compliance_documents'
        ]::text[]) as expected(doc_type)
        where not exists (
          select 1
          from public.tender_documents td
          where td.tender_id = t.id
            and td.doc_type = expected.doc_type
        )
      )
    )
    and (t.deadline is null or t.deadline >= current_date)
  order by t.match_score desc nulls last, t.created_at
  limit greatest(1, least(coalesce(p_limit, 25), 200));
$$;

comment on function public.pending_tender_drafts(integer) is
  'Matches missing any promised bid-pack document or notification, with company profile and representative contacts joined on. Service role only.';

revoke execute on function public.pending_tender_drafts(integer) from public;
grant execute on function public.pending_tender_drafts(integer) to service_role;
