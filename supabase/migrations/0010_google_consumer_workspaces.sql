-- Google consumer accounts receive a unique internal workspace domain rather
-- than sharing gmail.com (or another blocked consumer domain) with every user.
create or replace function public.complete_onboarding()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid                  uuid := auth.uid();
  v_email                text;
  v_meta                 jsonb;
  v_app_meta             jsonb;
  v_domain               text;
  v_signup               jsonb;
  v_status               text;
  v_sectors              text[];
  v_company_id           uuid;
  v_is_google            boolean := false;
  v_google_consumer      boolean := false;
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

  select
    u.email,
    coalesce(u.raw_user_meta_data, '{}'::jsonb),
    coalesce(u.raw_app_meta_data, '{}'::jsonb)
  into v_email, v_meta, v_app_meta
  from auth.users u
  where u.id = v_uid;

  if v_email is null then
    raise exception 'no email on record for the authenticated user'
      using errcode = '22004';
  end if;

  v_domain := public.normalise_email_domain(v_email);
  v_is_google :=
    v_app_meta ->> 'provider' = 'google'
    or coalesce(v_app_meta -> 'providers', '[]'::jsonb) @> '["google"]'::jsonb;

  v_google_consumer :=
    v_is_google
    and exists (
      select 1
      from public.blocked_email_domains b
      where b.domain = v_domain
    );

  if v_google_consumer then
    v_domain := 'google-' || replace(v_uid::text, '-', '') || '.oauth.invalid';
  end if;

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
        coalesce(
          nullif(trim(v_meta ->> 'company_name'), ''),
          case when v_google_consumer then 'My company' else v_domain end
        ),
        v_domain,
        nullif(trim(v_meta ->> 'industry'), ''),
        v_sectors,
        nullif(trim(v_meta ->> 'region'), ''),
        nullif(trim(v_meta ->> 'company_size'), '')
      )
      returning id into v_company_id;
    exception when unique_violation then
      raise exception 'a company is already registered for %', v_domain
        using errcode = '23505';
    end;
  end if;

  insert into public.representatives (id, company_id, full_name, email)
  values (
    v_uid,
    v_company_id,
    coalesce(
      nullif(trim(v_meta ->> 'full_name'), ''),
      nullif(trim(v_meta ->> 'name'), '')
    ),
    v_email
  );

  return v_company_id;
end;
$$;

comment on function public.complete_onboarding() is
  'Creates or joins the company for the authenticated user. Company-email accounts use their verified email domain; Google users on consumer domains receive a unique workspace identifier.';
