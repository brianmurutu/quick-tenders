-- Quick Tenders: internal staff accounts, in-app notifications, and pipeline
-- health reporting. Schema, one authorisation function, and RLS only.
--
-- Why admins are a table and not a column
-- ---------------------------------------
-- A representative is *defined* by belonging to exactly one company: 0001 pins
-- representatives.id to an auth user and resolves the tenant from it through
-- public.current_company_id(), which every policy in this database depends on.
-- Internal staff belong to no company. Putting a role column on
-- representatives would have meant a company_id that is null for a whole class
-- of account, and an "unless they are staff" branch inside
-- current_company_id() - that is, a change to the one function that authorises
-- every tenant read. Admin and company-rep are therefore separate tables with
-- separate primary keys into auth.users.
--
-- How an admin reads another tenant's data
-- ---------------------------------------
-- As themselves. is_admin() below is checked against auth.uid(), and the new
-- policies sit alongside the existing "own company only" ones. Nothing here
-- impersonates a representative: current_company_id() still resolves from
-- auth.uid() through public.representatives, an admin has no row there, so it
-- stays null for an admin and no company-scoped policy ever matches them. The
-- service role key stays reserved for the scheduled jobs
-- (see lib/supabase/admin.ts).
--
-- Why this cannot break an existing policy
-- ---------------------------------------
-- Every policy added here is a new, separate, permissive policy. Postgres ORs
-- permissive policies for the same command together, so an added policy can
-- only ever widen access, never narrow it. No policy from 0001-0007 is altered
-- or dropped by this migration, and none is redefined. The representative-facing
-- rules are byte for byte what they were.
--
-- is_admin() is SECURITY DEFINER for the same reason current_company_id() is:
-- it reads public.admin_users, which has its own RLS policy that calls
-- is_admin(). Running as the table owner bypasses that policy and so cannot
-- recurse.

-- ---------------------------------------------------------------------------
-- Internal staff
-- ---------------------------------------------------------------------------

create table public.admin_users (
  id         uuid        primary key references auth.users (id) on delete cascade,
  full_name  text,
  email      text        not null unique,
  created_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Quick Tenders internal staff. A Supabase auth user with no company; id = auth.users.id. Separate account type from public.representatives, not a role on it. Provisioned with the service role only, see the note under the policies below.';

-- ---------------------------------------------------------------------------
-- The authorisation predicate
-- ---------------------------------------------------------------------------
--
-- `stable` so a policy that references it is evaluated once per statement
-- rather than once per row. `security definer` and `set search_path = ''` for
-- the reasons in the header. Returns false rather than null for an
-- unauthenticated caller, because `exists` never yields null.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users a
    where a.id = auth.uid()
  );
$$;

comment on function public.is_admin() is
  'True when the calling auth user is Quick Tenders internal staff. Safe to reference inside RLS policies: SECURITY DEFINER, so reading admin_users does not re-enter that table''s own policy.';

-- ---------------------------------------------------------------------------
-- RLS on admin_users
-- ---------------------------------------------------------------------------
--
-- Admins may read the staff roster. There is deliberately no INSERT, UPDATE or
-- DELETE policy and no write grant to authenticated: if an admin could write
-- this table, one compromised staff session could mint further admins, and
-- every admin would effectively hold permanent access to every tenant. Creating
-- an admin is an out-of-band act, done with the service role key:
--
--   insert into public.admin_users (id, full_name, email)
--   values ('<auth.users.id>', 'Name', 'name@quicktenders.co.ke');
--
-- The auth user must exist first. There is no self-service signup path into
-- this table, and no equivalent of complete_onboarding() for it.

alter table public.admin_users enable row level security;

create policy admin_users_select_admin
  on public.admin_users
  for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Admin read access across tenants
-- ---------------------------------------------------------------------------
--
-- One SELECT policy per table, matching the per-command style of 0001. These
-- are additive: the ..._select_own_company policies from 0001 are untouched and
-- still the only thing a representative matches.
--
-- Read only, apart from companies. Extending a trial and changing a plan are
-- the admin write actions this step calls for, and both are on companies;
-- nothing yet requires an admin to edit a representative, a match or a
-- document, so none of those gets a write policy. Adding one later is a new
-- policy, not a change to these.

create policy companies_select_admin
  on public.companies
  for select
  to authenticated
  using (public.is_admin());

create policy representatives_select_admin
  on public.representatives
  for select
  to authenticated
  using (public.is_admin());

create policy tenders_matched_select_admin
  on public.tenders_matched
  for select
  to authenticated
  using (public.is_admin());

create policy tender_documents_select_admin
  on public.tender_documents
  for select
  to authenticated
  using (public.is_admin());

-- NOTE: this grants admins the tender_documents *rows* - doc_type and
-- storage_path - not the files. The storage.objects policy in 0006
-- (tender_documents_read_own_company) matches on
-- current_company_id()::text, which is null for an admin, so an admin cannot
-- download a draft bid document. That is left as it is on purpose: those files
-- are the commercially sensitive artefact 0006 put in a private bucket, and
-- staff being able to read every customer's draft pricing is a decision to take
-- deliberately rather than inherit from a metadata policy. Add an is_admin()
-- policy on storage.objects if and when that access is actually wanted.

-- companies: the admin write policy ---------------------------------------
--
-- Necessary for the two admin actions, but on its own NOT sufficient. See the
-- next section.

create policy companies_update_admin
  on public.companies
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Admin write path for trial and plan
-- ---------------------------------------------------------------------------
--
-- 0004 revoked table-wide UPDATE on public.companies from authenticated and
-- re-granted exactly five profile columns, because RLS decides which ROW a
-- caller may write and never which COLUMN. An admin signs in through the same
-- `authenticated` role as everybody else, so an UPDATE touching trial_ends_at
-- or plan is refused on column privilege before RLS is consulted at all. The
-- policy above is not enough by itself.
--
-- Granting those columns to `authenticated` would fix admins and reopen exactly
-- the hole 0004 closed: companies_update_own already passes for a
-- representative's own row, so every representative would regain the ability to
--
--   PATCH /rest/v1/companies?id=eq.<their own company>
--   { "trial_ends_at": "2099-01-01T00:00:00Z", "plan": "paid" }
--
-- and walk through the /dashboard trial gate. So the privileged columns stay
-- ungranted, and the two admin actions go through SECURITY DEFINER functions
-- that check is_admin() themselves. Running as the table owner is how they
-- reach columns no client role holds.
--
-- Both functions are granted to `authenticated`, which is safe precisely
-- because the is_admin() check is inside the function body rather than in a
-- grant: a representative may call them and will be refused.

create or replace function public.admin_extend_trial(
  p_company_id uuid,
  p_days       integer
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ends_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'admin_extend_trial requires an admin user'
      using errcode = '42501';
  end if;

  -- Bounded so a fat-fingered call cannot hand out a decade of free access.
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'p_days must be between 1 and 365, got %',
      coalesce(p_days::text, 'null')
      using errcode = '22023';
  end if;

  -- Extend from whichever is later, now or the current end date. Extending an
  -- already-expired trial by 7 days should give the company 7 days from today,
  -- not 7 days from a date that has already passed.
  update public.companies c
     set trial_ends_at = greatest(c.trial_ends_at, now())
                         + (p_days * interval '1 day')
   where c.id = p_company_id
  returning c.trial_ends_at into v_ends_at;

  if not found then
    raise exception 'no company with id %', p_company_id
      using errcode = 'P0002';
  end if;

  return v_ends_at;
end;
$$;

comment on function public.admin_extend_trial(uuid, integer) is
  'Admin only. Pushes a company''s trial_ends_at out by p_days (1-365) from today or its current end, whichever is later, and returns the new value. Has no effect on access for a company whose plan is not ''trial'' - lib/trial.ts ignores the dates for a paid plan; use admin_set_company_plan for that.';

create or replace function public.admin_set_company_plan(
  p_company_id uuid,
  p_plan       text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
begin
  if not public.is_admin() then
    raise exception 'admin_set_company_plan requires an admin user'
      using errcode = '42501';
  end if;

  -- Whitelisted, not free text. lib/trial.ts reads `plan === 'trial'` and
  -- treats every other value as a paid plan with unlimited access, so a typo
  -- ('pald', 'Paid', 'paid ') would silently hand out the product for free and
  -- look like a data entry slip rather than a billing bypass. companies.plan
  -- carries no check constraint of its own, so this is the guard.
  if p_plan is null or p_plan not in ('trial', 'paid') then
    raise exception 'p_plan must be ''trial'' or ''paid'', got %',
      coalesce(quote_literal(p_plan), 'null')
      using errcode = '22023';
  end if;

  update public.companies c
     set plan = p_plan
   where c.id = p_company_id
  returning c.plan into v_plan;

  if not found then
    raise exception 'no company with id %', p_company_id
      using errcode = 'P0002';
  end if;

  return v_plan;
end;
$$;

comment on function public.admin_set_company_plan(uuid, text) is
  'Admin only. Sets a company''s plan to ''trial'' or ''paid'' and returns it. The value is whitelisted because lib/trial.ts treats any non-trial value as unlimited access.';

-- ---------------------------------------------------------------------------
-- In-app notifications
-- ---------------------------------------------------------------------------
--
-- The in-app counterpart to the email and SMS that 0006 and 0007 send. Addressed
-- to a representative rather than to a company: "your document is ready" is
-- read by one person, and a per-person row is what makes an unread count and a
-- mark-as-read meaningful.
--
-- `type` is deliberately unconstrained. The known values are 'tender_matched',
-- 'document_ready', 'trial_ending' and 'trial_expired', but the set grows with
-- the product and a check constraint would mean a migration for each new one.
-- Nothing authorises off this column.

create table public.notifications (
  id                uuid        primary key default gen_random_uuid(),
  representative_id uuid        references public.representatives (id) on delete cascade,
  type              text,
  title             text,
  body              text,
  link_url          text,
  -- not null, unlike the sketch for this table: a null is_read is a row that
  -- counts as neither read nor unread, which quietly breaks both the badge
  -- count and the inbox filter.
  is_read           boolean     not null default false,
  created_at        timestamptz not null default now()
);

comment on table public.notifications is
  'In-app notifications for one representative. Written by the scheduled jobs with the service role; the representative may only read them and mark them read.';

comment on column public.notifications.type is
  'Known values: tender_matched, document_ready, trial_ending, trial_expired. Unconstrained on purpose; nothing authorises off it.';

-- The inbox read: one representative's notifications, newest first.
create index notifications_representative_id_created_at_idx
  on public.notifications (representative_id, created_at desc);

-- The badge count, which runs on every page load and only ever wants unread.
create index notifications_unread_idx
  on public.notifications (representative_id)
  where not is_read;

alter table public.notifications enable row level security;

-- Scoped to auth.uid(), not to current_company_id(). representatives.id IS the
-- auth user id (0001), so this is both the tightest available check and one
-- that needs no function call. A company-scoped policy would let one
-- representative read and mark read a colleague's notifications.

create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (representative_id = auth.uid());

create policy notifications_update_own
  on public.notifications
  for update
  to authenticated
  using (representative_id = auth.uid())
  with check (representative_id = auth.uid());

-- No INSERT or DELETE policy for authenticated, and no admin policy. The jobs
-- write these with the service role. A representative who could insert would be
-- able to plant arbitrary title, body and link_url into their own notification
-- feed, which is a self-phishing surface the moment the UI renders link_url as
-- a link; and a representative who could delete would be able to erase the
-- 'trial_expired' notice. Admins are left out because a notification is one
-- person's message, not tenant state an admin needs to support them.

-- ---------------------------------------------------------------------------
-- Discovery pipeline health
-- ---------------------------------------------------------------------------
--
-- One row per source per run of app/api/cron/discover-tenders, so "PPIP has
-- returned zero tenders for four days" is a query rather than something only
-- visible by scrolling Vercel logs.

create table public.scrape_runs (
  id              uuid        primary key default gen_random_uuid(),
  source          text,
  run_at          timestamptz not null default now(),
  tenders_fetched integer,
  -- not null, unlike the sketch for this table. A statusless row appears in
  -- neither the success nor the failure count, so a partially broken writer
  -- would make the pipeline look quiet rather than broken - the one failure
  -- mode this table exists to catch.
  status          text        not null
                              check (status in ('success', 'partial', 'failed')),
  error_message   text
);

comment on table public.scrape_runs is
  'One row per source per discovery run. Admin reporting only; written by the discovery job with the service role.';

comment on column public.scrape_runs.status is
  'success = every tender fetched, partial = some fetched with errors, failed = nothing fetched. error_message carries the detail for partial and failed.';

-- "Latest runs for this source" and "latest runs overall", the two reads an
-- admin health view makes.
create index scrape_runs_source_run_at_idx
  on public.scrape_runs (source, run_at desc);

create index scrape_runs_run_at_idx
  on public.scrape_runs (run_at desc);

alter table public.scrape_runs enable row level security;

create policy scrape_runs_select_admin
  on public.scrape_runs
  for select
  to authenticated
  using (public.is_admin());

-- No policy for a representative, and no write policy for authenticated: this
-- table is operational data about Quick Tenders, and the discovery job that
-- writes it runs as service_role.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
--
-- Explicit rather than relying on Supabase's default privileges, matching 0001.
-- `anon` gets nothing. Note that a grant to `authenticated` is not access on
-- its own: every table below has RLS enabled, so the is_admin() policies decide
-- who a row is visible to and the grant only decides which commands are
-- possible at all.

grant select on public.admin_users to authenticated;
grant select, insert, update, delete on public.admin_users to service_role;

grant select on public.scrape_runs to authenticated;
grant select, insert on public.scrape_runs to service_role;

grant select on public.notifications to authenticated;

-- Mark-as-read and nothing else, for the reason spelled out in 0004: RLS
-- decides which row, column privileges decide which column. A table-wide UPDATE
-- grant here would let a representative rewrite the type, title, body and
-- link_url of a notification they had been sent.
grant update (is_read) on public.notifications to authenticated;

grant select, insert, update, delete on public.notifications to service_role;

revoke execute on function public.is_admin() from public;
revoke execute on function public.admin_extend_trial(uuid, integer) from public;
revoke execute on function public.admin_set_company_plan(uuid, text) from public;

grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.admin_extend_trial(uuid, integer) to authenticated, service_role;
grant execute on function public.admin_set_company_plan(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Known gaps, recorded rather than silently left
-- ---------------------------------------------------------------------------
--
-- 1. Nothing prevents one auth user from having a row in BOTH admin_users and
--    representatives. Such an account would read every tenant AND belong to a
--    company. A cross-table exclusion needs a trigger on both tables, which is
--    more machinery than this step asked for; the provisioning insert above is
--    the place to check, and it is service-role-only work.
-- 2. public.subscriptions is not covered here, so an admin cannot read a
--    company's Paystack payment history. That is the obvious next thing an
--    admin looking at a plan will want; it is a one-policy addition when it is
--    wanted, deliberately not assumed now.
-- 3. Admins cannot download draft bid documents from storage. See the note
--    under tender_documents_select_admin.
