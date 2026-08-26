-- Quick Tenders: gate signup on an existing representative.
--
-- 0002 blocked a signup as soon as a company row existed for the domain. The
-- product rule is narrower: block when that company already has a representative
-- registered, and tell the newcomer who to ask for access. A company row with no
-- representative is joined rather than duplicated, which also means an account
-- seeded out of band (an import, a sales-led setup) can still be claimed by its
-- first representative.
--
-- DISCLOSURE NOTE: company_signup_status returns the existing representative
-- name and email to an unauthenticated caller, because the blocking message has
-- to name somebody to contact. That makes this function an email lookup for any
-- domain that has an account. It is a deliberate trade for the signup message
-- asked for; rate limit it at the edge if harvesting becomes a concern.

-- Superseded by company_signup_status below, which covers every case it did.
drop function if exists public.company_domain_status(text);

create or replace function public.company_signup_status(p_domain text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_domain     text := nullif(lower(trim(coalesce(p_domain, ''))), '');
  v_company_id uuid;
  v_company    text;
  v_rep_name   text;
  v_rep_email  text;
begin
  if v_domain is null or position('.' in v_domain) = 0 then
    return jsonb_build_object('status', 'invalid');
  end if;

  if exists (
    select 1 from public.blocked_email_domains b where b.domain = v_domain
  ) then
    return jsonb_build_object('status', 'not_company_domain');
  end if;

  select c.id, c.name
    into v_company_id, v_company
  from public.companies c
  where c.domain = v_domain;

  if v_company_id is null then
    return jsonb_build_object('status', 'available');
  end if;

  -- The earliest registered representative is the one to point people at.
  select r.full_name, r.email
    into v_rep_name, v_rep_email
  from public.representatives r
  where r.company_id = v_company_id
  order by r.created_at, r.email
  limit 1;

  if v_rep_email is null then
    return jsonb_build_object(
      'status', 'join_existing',
      'company_name', v_company
    );
  end if;

  return jsonb_build_object(
    'status', 'representative_exists',
    'company_name', v_company,
    'representative_name', v_rep_name,
    'representative_email', v_rep_email
  );
end;
$$;

comment on function public.company_signup_status(text) is
  'Signup gate for a domain. Returns status available, join_existing, representative_exists, not_company_domain or invalid, with the contact details of the existing representative when there is one.';

-- ---------------------------------------------------------------------------
-- Onboarding, updated for the join_existing case
-- ---------------------------------------------------------------------------

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
  v_signup     jsonb;
  v_status     text;
  v_sectors    text[];
  v_company_id uuid;
begin
  if v_uid is null then
    raise exception 'complete_onboarding requires an authenticated user'
      using errcode = '28000';
  end if;

  -- Idempotent: confirming the same email twice must not create a second company.
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
  v_signup := public.company_signup_status(v_domain);
  v_status := v_signup ->> 'status';

  if v_status = 'invalid' then
    raise exception 'cannot register % as a company domain: invalid', v_domain
      using errcode = '22023';
  end if;

  if v_status = 'not_company_domain' then
    raise exception 'cannot register % as a company domain: not_company_domain',
      v_domain
      using errcode = '23505';
  end if;

  if v_status = 'representative_exists' then
    raise exception 'a representative is already registered for %', v_domain
      using errcode = '23505';
  end if;

  if v_status = 'join_existing' then
    -- Lock the company row so two people claiming the same unclaimed company at
    -- once cannot both pass the check below.
    select c.id into v_company_id
    from public.companies c
    where c.domain = v_domain
    for update;

    if v_company_id is null then
      raise exception 'company for % is no longer available', v_domain
        using errcode = '23505';
    end if;

    if exists (
      select 1 from public.representatives r where r.company_id = v_company_id
    ) then
      raise exception 'a representative is already registered for %', v_domain
        using errcode = '23505';
    end if;
  else
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
      -- on domain is the real guard; the status check above is the fast path.
      raise exception 'a company is already registered for %', v_domain
        using errcode = '23505';
    end;
  end if;

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
  'Creates or joins the company for the calling auth user, using their verified email domain, and registers them as its representative. Idempotent.';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.company_signup_status(text) from public;
grant execute on function public.company_signup_status(text)
  to anon, authenticated, service_role;
