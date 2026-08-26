-- Quick Tenders: payment tracking + phone number for SMS.
--
-- Adds Paystack subscription tracking fields to companies, a phone number for
-- SMS delivery to representatives, and a subscriptions audit table.

-- ---------------------------------------------------------------------------
-- New columns on companies
-- ---------------------------------------------------------------------------

alter table public.companies
  add column if not exists paystack_customer_code    text,
  add column if not exists paystack_subscription_code text;

comment on column public.companies.paystack_customer_code is
  'Paystack customer code (CUS_...) created on first charge.';
comment on column public.companies.paystack_subscription_code is
  'Paystack subscription code (SUB_...) created when a recurring plan starts.';

-- ---------------------------------------------------------------------------
-- Phone number on representatives
-- ---------------------------------------------------------------------------

alter table public.representatives
  add column if not exists phone_number text;

comment on column public.representatives.phone_number is
  'E.164 or local Kenyan format. Used to send TextSMS.co.ke notifications.';

-- ---------------------------------------------------------------------------
-- Subscriptions audit table
-- ---------------------------------------------------------------------------

create table if not exists public.subscriptions (
  id                  uuid        primary key default gen_random_uuid(),
  company_id          uuid        not null references public.companies (id) on delete cascade,
  paystack_reference  text        not null,
  event_type          text        not null,  -- 'charge.success', 'subscription.create', etc.
  amount_kobo         bigint,                -- amount in smallest currency unit (kobo / cents)
  currency            text,
  status              text        not null default 'success',
  payload             jsonb,
  created_at          timestamptz not null default now()
);

comment on table public.subscriptions is
  'Audit log of Paystack payment events received via webhook.';

create index if not exists subscriptions_company_id_idx
  on public.subscriptions (company_id);

create unique index if not exists subscriptions_reference_idx
  on public.subscriptions (paystack_reference);

-- ---------------------------------------------------------------------------
-- RLS for subscriptions
-- ---------------------------------------------------------------------------

alter table public.subscriptions enable row level security;

-- Representatives can read their own company's subscription history.
create policy subscriptions_select_own_company
  on public.subscriptions
  for select
  to authenticated
  using (company_id = public.current_company_id());

-- Only service role (webhook handler) can insert. Authenticated users cannot
-- manufacture payment records.
-- (No insert policy for authenticated role → only service_role can write.)

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select on public.subscriptions to authenticated;
grant select, insert, update on public.subscriptions to service_role;

-- Allow representatives to update their own phone_number.
-- migration 0004 already granted update on companies columns; we need the same
-- for the new column, but the existing GRANT covers the whole table.

-- Allow the onboarding action (which runs as the representative) to update
-- phone_number on representatives. The existing grant from 0001 covers this.

-- ---------------------------------------------------------------------------
-- Update pending_tender_drafts RPC to include representative phone numbers
-- ---------------------------------------------------------------------------
--
-- PostgreSQL does not let CREATE OR REPLACE change a function's OUT/return
-- columns. Drop the 0006 version first, then recreate it with the phone array.
-- There are no SQL dependencies on this RPC, and the grants are restored below.

drop function if exists public.pending_tender_drafts(integer);

create function public.pending_tender_drafts(p_limit integer default 25)
returns table (
  tender_id             uuid,
  title                 text,
  source_url            text,
  deadline              date,
  summary               text,
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
  representative_emails text[],
  representative_phones text[]
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
    reps.representative_emails,
    reps.representative_phones
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
      array_agg(r.email order by r.created_at, r.email)          as representative_emails,
      array_remove(
        array_agg(r.phone_number order by r.created_at, r.email),
        null
      )                                                           as representative_phones
    from public.representatives r
    where r.company_id = c.id
  ) reps on true
  where (coalesce(d.document_count, 0) = 0 or t.notified_at is null)
    and (t.deadline is null or t.deadline >= current_date)
  order by t.match_score desc nulls last, t.created_at
  limit greatest(1, least(coalesce(p_limit, 25), 200));
$$;

comment on function public.pending_tender_drafts(integer) is
  'Matches still needing documents or a notification, with company profile and representative contacts (email + phone) joined on. Service role only.';

revoke execute on function public.pending_tender_drafts(integer) from public;
grant execute on function public.pending_tender_drafts(integer) to service_role;
