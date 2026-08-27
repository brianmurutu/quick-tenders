-- Quick Tenders: restrict which company columns a representative may write.
--
-- 0001 granted UPDATE on the whole companies table to authenticated. RLS decides
-- which ROW a representative may touch, never which COLUMNS, so a blanket grant
-- means a crafted request straight at PostgREST could do this:
--
--   PATCH /rest/v1/companies?id=eq.<their own company>
--   { "trial_ends_at": "2099-01-01T00:00:00Z", "plan": "enterprise" }
--
-- The row check passes, because it really is their own company. That would let
-- any representative extend their own trial and walk through the /dashboard
-- gate. Onboarding needs to write the matching profile, so the fix is to grant
-- UPDATE on exactly those columns and nothing else.
--
-- Postgres denies an UPDATE that touches a column the role has no privilege on,
-- so this holds regardless of what the request looks like.

revoke update on public.companies from authenticated;

grant update (
  name,
  industry,
  sectors_of_interest,
  region,
  company_size
) on public.companies to authenticated;

-- Deliberately NOT grantable to a representative:
--   id, domain           the tenancy key; changing either would move or steal a tenant
--   plan                 billing state, set by the billing system
--   trial_started_at     set once by companies_set_trial_window
--   trial_ends_at        the value the /dashboard trial gate reads
--   created_at           audit field
--
-- complete_onboarding() is SECURITY DEFINER and runs as the table owner, so it
-- is unaffected by these grants and can still create a company in full.

comment on table public.companies is
  'Tenant root. One row per customer company; all other tables hang off this. Representatives may only update the matching profile columns, see 0004.';
