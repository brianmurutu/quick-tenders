-- Quick Tenders: initial schema.
--
-- Tenancy model
-- -------------
-- Every row belongs to a company. A representative is a Supabase auth user
-- pinned to exactly one company; RLS resolves that company once via
-- public.current_company_id() and scopes every table to it.
--
-- current_company_id() is SECURITY DEFINER on purpose: it must read
-- public.representatives without triggering that table's own RLS policies,
-- which would recurse infinitely.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.companies (
  id                  uuid        primary key default gen_random_uuid(),
  name                text,
  domain              text        not null unique,
  industry            text,
  sectors_of_interest text[],
  region              text,
  company_size        text,
  trial_started_at    timestamptz not null default now(),
  -- Filled by companies_set_trial_window on insert (trial_started_at + 3 days)
  -- when not supplied, so NOT NULL is always satisfiable.
  trial_ends_at       timestamptz not null,
  plan                text        not null default 'trial',
  created_at          timestamptz not null default now()
);

comment on table public.companies is
  'Tenant root. One row per customer company; all other tables hang off this.';

create table public.representatives (
  id         uuid        primary key references auth.users (id) on delete cascade,
  company_id uuid        references public.companies (id) on delete cascade,
  full_name  text,
  email      text        not null unique,
  created_at timestamptz not null default now()
);

comment on table public.representatives is
  'A Supabase auth user acting on behalf of one company. id = auth.users.id.';

create table public.tenders_matched (
  id          uuid        primary key default gen_random_uuid(),
  company_id  uuid        references public.companies (id) on delete cascade,
  title       text,
  source_url  text,
  deadline    date,
  summary     text,
  match_score numeric,
  status      text        not null default 'new'
                          check (status in ('new', 'reviewed', 'submitted', 'expired')),
  created_at  timestamptz not null default now()
);

comment on table public.tenders_matched is
  'Tenders surfaced for a company by the matching pipeline.';

create table public.tender_documents (
  id           uuid        primary key default gen_random_uuid(),
  tender_id    uuid        references public.tenders_matched (id) on delete cascade,
  doc_type     text,
  storage_path text,
  created_at   timestamptz not null default now()
);

comment on table public.tender_documents is
  'Files attached to a matched tender. storage_path points into Supabase Storage.';

-- ---------------------------------------------------------------------------
-- Indexes (foreign keys are not indexed automatically in Postgres)
-- ---------------------------------------------------------------------------

create index representatives_company_id_idx
  on public.representatives (company_id);

create index tenders_matched_company_id_idx
  on public.tenders_matched (company_id);

-- Supports the common "open tenders for my company, soonest first" read.
create index tenders_matched_company_id_deadline_idx
  on public.tenders_matched (company_id, deadline);

create index tender_documents_tender_id_idx
  on public.tender_documents (tender_id);

-- ---------------------------------------------------------------------------
-- Trial window: trial_ends_at = trial_started_at + 3 days
-- ---------------------------------------------------------------------------

create or replace function public.set_company_trial_window()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.trial_started_at := coalesce(new.trial_started_at, now());
  new.trial_ends_at    := coalesce(new.trial_ends_at,
                                   new.trial_started_at + interval '3 days');
  return new;
end;
$$;

comment on function public.set_company_trial_window() is
  'Defaults trial_ends_at to trial_started_at + 3 days on insert.';

create trigger companies_set_trial_window
  before insert on public.companies
  for each row
  execute function public.set_company_trial_window();

-- ---------------------------------------------------------------------------
-- Tenancy helpers
-- ---------------------------------------------------------------------------

-- The company of the calling representative, or null if the caller has no
-- representative row. SECURITY DEFINER so it bypasses RLS on
-- public.representatives (see the note at the top of this file).
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.company_id
  from public.representatives r
  where r.id = auth.uid();
$$;

comment on function public.current_company_id() is
  'company_id of the calling auth user, resolved via public.representatives.';

-- tender_documents has no company_id of its own; authorise through the parent
-- tender. SECURITY DEFINER keeps this to a single indexed lookup instead of
-- re-evaluating tenders_matched policies inside every document policy.
create or replace function public.tender_belongs_to_current_company(p_tender_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenders_matched t
    where t.id = p_tender_id
      and t.company_id = public.current_company_id()
  );
$$;

comment on function public.tender_belongs_to_current_company(uuid) is
  'True when the given tender belongs to the calling representative''s company.';

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
--
-- Policies are written per command rather than as `for all` so each grant is
-- explicit and auditable. `service_role` bypasses RLS entirely and is what the
-- signup/onboarding path must use. See the note under `companies` below.

alter table public.companies       enable row level security;
alter table public.representatives enable row level security;
alter table public.tenders_matched enable row level security;
alter table public.tender_documents enable row level security;

-- companies -----------------------------------------------------------------
--
-- Note: an authenticated user cannot INSERT a company, because before their
-- representative row exists current_company_id() is null. Company creation is
-- therefore an onboarding concern. Do it from a trusted server context with
-- the service role key, or add a SECURITY DEFINER RPC that creates the company
-- and the representative row together.

create policy companies_select_own
  on public.companies
  for select
  to authenticated
  using (id = public.current_company_id());

create policy companies_insert_own
  on public.companies
  for insert
  to authenticated
  with check (id = public.current_company_id());

create policy companies_update_own
  on public.companies
  for update
  to authenticated
  using (id = public.current_company_id())
  with check (id = public.current_company_id());

create policy companies_delete_own
  on public.companies
  for delete
  to authenticated
  using (id = public.current_company_id());

-- representatives -----------------------------------------------------------
--
-- SELECT also matches the caller's own row so a representative who has not
-- been attached to a company yet can still read themselves. Writes are
-- deliberately company-scoped only: allowing `id = auth.uid()` on insert would
-- let a user attach themselves to any company_id they liked.

create policy representatives_select_own_company
  on public.representatives
  for select
  to authenticated
  using (id = auth.uid() or company_id = public.current_company_id());

create policy representatives_insert_own_company
  on public.representatives
  for insert
  to authenticated
  with check (company_id = public.current_company_id());

create policy representatives_update_own_company
  on public.representatives
  for update
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy representatives_delete_own_company
  on public.representatives
  for delete
  to authenticated
  using (company_id = public.current_company_id());

-- tenders_matched -----------------------------------------------------------

create policy tenders_matched_select_own_company
  on public.tenders_matched
  for select
  to authenticated
  using (company_id = public.current_company_id());

create policy tenders_matched_insert_own_company
  on public.tenders_matched
  for insert
  to authenticated
  with check (company_id = public.current_company_id());

create policy tenders_matched_update_own_company
  on public.tenders_matched
  for update
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy tenders_matched_delete_own_company
  on public.tenders_matched
  for delete
  to authenticated
  using (company_id = public.current_company_id());

-- tender_documents ----------------------------------------------------------

create policy tender_documents_select_own_company
  on public.tender_documents
  for select
  to authenticated
  using (public.tender_belongs_to_current_company(tender_id));

create policy tender_documents_insert_own_company
  on public.tender_documents
  for insert
  to authenticated
  with check (public.tender_belongs_to_current_company(tender_id));

create policy tender_documents_update_own_company
  on public.tender_documents
  for update
  to authenticated
  using (public.tender_belongs_to_current_company(tender_id))
  with check (public.tender_belongs_to_current_company(tender_id));

create policy tender_documents_delete_own_company
  on public.tender_documents
  for delete
  to authenticated
  using (public.tender_belongs_to_current_company(tender_id));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
--
-- Explicit rather than relying on Supabase's default privileges. `anon` gets
-- nothing: every table here is tenant data behind a login.

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.companies        to authenticated;
grant select, insert, update, delete on public.representatives  to authenticated;
grant select, insert, update, delete on public.tenders_matched  to authenticated;
grant select, insert, update, delete on public.tender_documents to authenticated;

revoke execute on function public.current_company_id() from public;
revoke execute on function public.tender_belongs_to_current_company(uuid) from public;

grant execute on function public.current_company_id() to authenticated, service_role;
grant execute on function public.tender_belongs_to_current_company(uuid) to authenticated, service_role;
