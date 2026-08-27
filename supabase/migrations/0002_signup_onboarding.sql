-- Quick Tenders: signup and onboarding.
--
-- 0001 deliberately left companies un-insertable by authenticated users: the
-- RLS check is id = current_company_id(), which is null until a representative
-- row exists. This migration adds the way in, without handing the service role
-- key to the app: a SECURITY DEFINER RPC that creates the company and the
-- representative together in one transaction.
--
-- The security-critical field is derived, not supplied. companies.domain always
-- comes from the address Supabase has already verified, never from client
-- input, so a user cannot claim a domain that is not theirs.

-- ---------------------------------------------------------------------------
-- Email domains that never identify a company
-- ---------------------------------------------------------------------------
--
-- companies.domain is unique, so without this the first person to sign up with
-- a consumer address would claim the entire provider domain and lock out every
-- other user of that provider.

create table public.blocked_email_domains (
  domain     text        primary key,
  created_at timestamptz not null default now()
);

comment on table public.blocked_email_domains is
  'Consumer and disposable email providers that cannot become a company domain. Read only through the SECURITY DEFINER helpers below.';

alter table public.blocked_email_domains enable row level security;

-- No policies, and no grants: this table is invisible to anon and authenticated
-- even though the helpers that read it are callable by both.
revoke all on public.blocked_email_domains from anon, authenticated;

insert into public.blocked_email_domains (domain) values
  ('gmail.com'), ('googlemail.com'), ('outlook.com'), ('outlook.co.uk'),
  ('hotmail.com'), ('hotmail.co.uk'), ('live.com'), ('live.co.uk'), ('msn.com'),
  ('yahoo.com'), ('yahoo.co.uk'), ('ymail.com'), ('aol.com'),
  ('icloud.com'), ('me.com'), ('mac.com'),
  ('proton.me'), ('protonmail.com'), ('pm.me'),
  ('gmx.com'), ('gmx.net'), ('zoho.com'), ('yandex.com'), ('mail.com'),
  ('mailinator.com'), ('guerrillamail.com'), ('sharklasers.com'),
  ('10minutemail.com'), ('tempmail.com'), ('trashmail.com'), ('yopmail.com');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.normalise_email_domain(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(lower(trim(split_part(coalesce(p_email, ''), '@', 2))), '');
$$;

comment on function public.normalise_email_domain(text) is
  'Lowercased domain part of an email address, or null if there is not one.';

-- Callable before signup so the form can reject a domain up front instead of
-- failing after the user has already confirmed their email.
--
-- Note: this tells an unauthenticated caller whether a given domain is
-- registered. That is a deliberate trade for a usable signup flow, and it only
-- confirms domains the caller already thought to ask about. Rate limit it at
-- the edge if enumeration becomes a concern.
create or replace function public.company_domain_status(p_domain text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_domain text := nullif(lower(trim(coalesce(p_domain, ''))), '');
begin
  if v_domain is null or position('.' in v_domain) = 0 then
    return 'invalid';
  end if;

  if exists (
    select 1 from public.blocked_email_domains b where b.domain = v_domain
  ) then
    return 'not_company_domain';
  end if;

  if exists (
    select 1 from public.companies c where c.domain = v_domain
  ) then
    return 'taken';
  end if;

  return 'available';
end;
$$;

comment on function public.company_domain_status(text) is
  'One of available, taken, not_company_domain, invalid.';

-- ---------------------------------------------------------------------------
-- Onboarding
-- ---------------------------------------------------------------------------
--
-- Called once the user is authenticated, which with email confirmation on means
-- from the /auth/callback route. Company details ride along in the auth user
-- metadata set at signup, so nothing has to be stored between the two steps.
--
-- Idempotent: confirming the same email twice returns the existing company
-- rather than creating a second one.

create or replace function public.complete_onboarding()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_email      text;
  v_meta       jsonb;
  v_domain     text;
  v_status     text;
  v_sectors    text[];
  v_company_id uuid;
begin
  if v_uid is null then
    raise exception 'complete_onboarding requires an authenticated user'
      using errcode = '28000';
  end if;

  select r.company_id into v_company_id
  from public.representatives r
  where r.id = v_uid;

  if v_company_id is not null then
    return v_company_id;
  end if;

  select u.email, coalesce(u.raw_user_meta_data, '{}'::jsonb)
    into v_email, v_meta
  from auth.users u
  where u.id = v_uid;

  if v_email is null then
    raise exception 'no email on record for the authenticated user'
      using errcode = '22004';
  end if;

  v_domain := public.normalise_email_domain(v_email);
  v_status := public.company_domain_status(v_domain);

  if v_status <> 'available' then
    raise exception 'cannot register % as a company domain: %', v_domain, v_status
      using errcode = '23505';
  end if;

  if jsonb_typeof(v_meta -> 'sectors_of_interest') = 'array' then
    select array_agg(value)
      into v_sectors
    from jsonb_array_elements_text(v_meta -> 'sectors_of_interest') as t(value);
  end if;

  begin
    insert into public.companies (
      name, domain, industry, sectors_of_interest, region, company_size
    ) values (
      coalesce(nullif(trim(v_meta ->> 'company_name'), ''), v_domain),
      v_domain,
      nullif(trim(v_meta ->> 'industry'), ''),
      v_sectors,
      nullif(trim(v_meta ->> 'region'), ''),
      nullif(trim(v_meta ->> 'company_size'), '')
    )
    returning id into v_company_id;
  exception when unique_violation then
    -- Two people from the same new domain confirming at once. The unique index
    -- is the real guard; company_domain_status above is only the fast path.
    raise exception 'a company is already registered for %', v_domain
      using errcode = '23505';
  end;

  insert into public.representatives (id, company_id, full_name, email)
  values (
    v_uid,
    v_company_id,
    nullif(trim(v_meta ->> 'full_name'), ''),
    v_email
  );

  return v_company_id;
end;
$$;

comment on function public.complete_onboarding() is
  'Creates the company and representative rows for the calling auth user, using their verified email domain. Idempotent.';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to anon;

revoke execute on function public.normalise_email_domain(text) from public;
revoke execute on function public.company_domain_status(text) from public;
revoke execute on function public.complete_onboarding() from public;

grant execute on function public.normalise_email_domain(text) to anon, authenticated, service_role;
grant execute on function public.company_domain_status(text) to anon, authenticated, service_role;
grant execute on function public.complete_onboarding() to authenticated, service_role;
