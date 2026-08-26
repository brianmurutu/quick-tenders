# Quick Tenders

Tender matching for companies. Next.js 14 (App Router) + TypeScript + Tailwind
CSS, with Supabase for auth, Postgres and storage.

An AI agent finds tenders matching a company profile and drafts the bid
documents; a representative proofreads and submits.

## Setup

```bash
npm install
cp .env.local.example .env.local   # then fill in your project values
npm run dev
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL, from Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key, same page |
| `NEXT_PUBLIC_SITE_URL` | Public origin, used to build the email confirmation redirect |

The first two are public by design; row level security, not key secrecy, is what
keeps tenants apart. Without `.env.local` the site still boots: the middleware
logs a warning and skips session refresh, and the client factories throw on
first use.

## Applying the schema

```bash
supabase init          # only if you want the local stack; writes supabase/config.toml
supabase link --project-ref <your-project-ref>
supabase db push
```

Migrations run in order:

- `0001_init.sql`: the four tables, the trial trigger, RLS on everything.
- `0002_signup_onboarding.sql`: the onboarding RPC, the domain status helper,
  and the blocked email domain list.
- `0003_signup_gate.sql`: gates signup on an existing representative and
  returns their contact details for the blocking message.
- `0004_company_profile_writes.sql`: column level UPDATE grants on `companies`,
  so a representative can write the matching profile but not `plan` or
  `trial_ends_at`.

If your CLI version rejects the `0001_` prefix, rename both files to 14-digit
timestamp prefixes, keeping their relative order.

## Supabase project configuration

Signup will not complete until two things are set in the dashboard:

1. **Authentication > URL Configuration**: add `NEXT_PUBLIC_SITE_URL` to Site
   URL, and `<site url>/auth/callback` to Redirect URLs. Confirmation links are
   rejected otherwise.
2. **Authentication > Providers > Email**: leave "Confirm email" on for the
   normal flow. Turning it off also works; the signup action detects the live
   session and finishes onboarding immediately instead of waiting for a click.

## Layout

```
app/                        Landing page and standing content pages
app/signup/                 Signup form, plus the server action that runs it
app/auth/callback/          Where the email confirmation link lands
app/onboarding/             Matching profile form, and the action that saves it
app/dashboard/              Trial-gated product area (layout.tsx holds the gate)
app/upgrade/                Where the trial gate sends an expired account
components/                 Shared header, footer, content page shell, app header
lib/env.ts                  Reads and validates the environment
lib/company-profile.ts      Industry, sector, county and size lists, plus validation
lib/signup.ts               Signup fields, validation, and status parsing
lib/trial.ts                Trial window evaluation
lib/url.ts                  Open redirect guard for ?next=
lib/supabase/client.ts      Typed client for Client Components
lib/supabase/server.ts      Typed client for Server Components / Actions / Routes
lib/supabase/middleware.ts  Auth token refresh, used by middleware.ts
types/database.ts           Schema types, `supabase gen types` shape
types/index.ts              Convenience aliases, import from `@/types`
supabase/migrations/        SQL migrations
```

Routes: `/`, `/signup`, `/onboarding`, `/dashboard`, `/upgrade`, `/about`,
`/contact`, `/careers`, `/privacy`, `/terms`, `/security`, and the
`/auth/callback` handler.

Pick the Supabase client by where the code runs:

```ts
// Server Component, Server Action, Route Handler. One per request.
import { createClient } from '@/lib/supabase/server'

// Client Component
import { createClient } from '@/lib/supabase/client'
```

## Data model

| Table | Purpose |
| --- | --- |
| `companies` | Tenant root. Unique `domain`, `plan`, trial window. |
| `representatives` | An `auth.users` row acting for one company. |
| `tenders_matched` | Tenders surfaced for a company, with `match_score` and `status`. |
| `tender_documents` | Files attached to a matched tender. |
| `blocked_email_domains` | Consumer and disposable providers, read only via SECURITY DEFINER helpers. |

`companies.trial_ends_at` is set to `trial_started_at + 3 days` on insert by the
`companies_set_trial_window` trigger unless a value is passed explicitly.

`tenders_matched.status` is constrained to `new` / `reviewed` / `submitted` /
`expired`. The union lives in `types/database.ts`; the runtime counterpart is
`TENDER_STATUSES` in `types/index.ts`.

## How signup works

Email and password, via Supabase Auth. Signup collects only the account details
(name, company email, password, company name). The matching profile is collected
at `/onboarding`, which is the sole owner of those columns.

1. The form collects name, company email, password and company name.
   `lib/signup.ts` validates it, and the same function runs again inside the
   server action, since a crafted request can send anything.
2. The action derives the domain from the email and calls
   `company_signup_status(domain)` before creating anything. The five outcomes:

   | Status | What happens |
   | --- | --- |
   | `available` | Proceed; a new company will be created. |
   | `join_existing` | Proceed; a company row exists for the domain but has no representative, so this signup claims it. |
   | `representative_exists` | **Blocked.** The form shows who to ask for access, using the returned name and email. |
   | `not_company_domain` | Blocked inline on the email field. |
   | `invalid` | Blocked inline on the email field. |

3. `auth.signUp` is called with the company details in user metadata, so nothing
   needs storing between signup and confirmation.
4. The confirmation link lands on `/auth/callback`, which exchanges it for a
   session, calls `complete_onboarding()`, and redirects to `/onboarding`.
5. `complete_onboarding()` creates or claims the company and registers the
   representative, taking the domain from the **verified** email address rather
   than any form field. It is idempotent, and it re-checks the gate under a row
   lock so two people claiming one company at the same moment cannot both win.

If email confirmations are off, `signUp` returns a live session, so the action
finishes onboarding immediately and the form redirects to `/onboarding` itself.

### The blocking message discloses a colleague email

`company_signup_status()` returns the existing representative name and email to
an **unauthenticated** caller, because the blocking message has to name somebody
to contact. That makes it an email lookup for any domain with an account.

It is a deliberate trade for the signup experience. If harvesting is a concern,
the options are: rate limit the endpoint at the edge, put a CAPTCHA in front of
the form, or return only the company name and route access requests through
support instead of naming a person.

## Onboarding: the matching profile

`/onboarding` collects the four columns the tender matching agent will read, and
the form field names are the column names, deliberately: `industry`,
`sectors_of_interest`, `region`, `company_size`. No camel casing on the way in
and no mapping layer in the middle.

`lib/company-profile.ts` holds the reference lists and the validation:

| Field | Column | Source |
| --- | --- | --- |
| Industry | `industry` | `INDUSTRIES`, single select |
| Sectors | `sectors_of_interest` | `SECTORS`, 1 to `MAX_SECTORS` (8) checkboxes, stored as `text[]` |
| County | `region` | `COUNTIES`, the 47 counties of Kenya in First Schedule order |
| Company size | `company_size` | `COMPANY_SIZES`, single select |

Every value is validated against its list on the server, not merely checked for
being non-empty, because the form posts to a server action that any client can
call. The page prefills from whatever is already stored and silently drops values
no longer on a list, so the form never opens on something it cannot submit. On
success it redirects to `/dashboard`.

County names are the official ones, since tender notices are published against
them: `Nairobi City` rather than `Nairobi`, `Taita-Taveta` rather than
`Taita Taveta`. If you change a list, existing rows keep the old value until the
representative next saves, so add rather than rename where you can.

### Representatives cannot write billing columns

Migration `0004` revokes table-wide `UPDATE` on `companies` and grants it on
`name`, `industry`, `sectors_of_interest`, `region` and `company_size` only.

This matters because RLS decides which **row** a representative may touch, never
which **columns**. With the blanket grant that `0001` gave, a request straight at
PostgREST could have done this:

```
PATCH /rest/v1/companies?id=eq.<their own company>
{ "trial_ends_at": "2099-01-01T00:00:00Z", "plan": "enterprise" }
```

The row check passes, because it genuinely is their own company. That would have
let any representative extend their own trial and walk through the `/dashboard`
gate. Postgres refuses an `UPDATE` that touches a column the role has no
privilege on, including one that mixes permitted and protected columns in a
single statement, so the grant list is the whole defence.
`complete_onboarding()` is `SECURITY DEFINER` and so is unaffected.

## Trial expiry

`app/dashboard/layout.tsx` is the gate. It runs on every navigation into
`/dashboard` and any route nested beneath it, and redirects to:

- `/signup` when nobody is signed in.
- `/onboarding` when the user has no company yet.
- `/upgrade?reason=expired` when `plan` is `trial` and `trial_ends_at` has
  passed.
- `/upgrade?reason=unavailable` when the company row cannot be read at all.

It is a server check rather than middleware on purpose. Middleware runs for
every matched request, so the company lookup would add a database round trip
across the board, and it could not be the authoritative boundary anyway. RLS and
this layout are what actually decide. `lib/trial.ts` holds the pure evaluation,
which **fails closed**: a trial plan whose `trial_ends_at` cannot be parsed is
treated as expired rather than open. A paid plan is never gated by trial dates.

## Row level security

RLS is on for every table and `anon` has no table grants, so everything is
behind a login. Policies resolve the caller company through
`public.current_company_id()`, which looks up `auth.uid()` in `representatives`.
It is `SECURITY DEFINER` so it can read that table without re-entering its own
policies, which would recurse. `tender_documents` authorises through its parent
tender via `public.tender_belongs_to_current_company()`.

Two behaviours worth knowing:

- **An authenticated user still cannot insert a company directly.** That is why
  `complete_onboarding()` exists: it is `SECURITY DEFINER`, so onboarding never
  needs the service role key in the application.
- **A representative can read their own row even with a null `company_id`**, so
  a user not yet attached to a company is not locked out of themselves. Writes
  stay company-scoped only; allowing self-writes would let a user attach
  themselves to any company.

`company_domain_status()` is callable by `anon`, which means it reveals whether
a given domain is registered. That is a deliberate trade for a usable signup
flow. Rate limit it at the edge if enumeration becomes a concern.

## Regenerating types

`types/database.ts` is hand-written to match the migrations. Once a project is
linked:

```bash
npm run db:types
```

The generator widens check constraints to `string`; re-narrow
`tenders_matched.status` to `TenderStatus` and `company_domain_status` to
`CompanyDomainStatus` afterwards.

## Before launch

- **There is no sign-in page.** Signup works, but a returning representative has
  nowhere to authenticate, so the `/dashboard` guard can only ever bounce them to
  `/signup`. This is the next thing to build.
- Contact addresses across `/contact`, `/careers`, `/privacy`, `/terms` and
  `/security` use the reserved `quicktenders.example` domain. Replace them with
  real inboxes.
- `/privacy` and `/terms` carry a visible draft banner and need review by a
  lawyer. The liability, governing law and fee sections in particular are
  placeholders.
- `/security` deliberately states what is **not** in place (no SOC 2, no
  penetration test, no bug bounty). Update it as that changes rather than
  leaving it stale.
- `/about` has no team, founding or location details, because those are facts
  only you can supply.
- `npm audit` reports advisories in `next` and `eslint-config-next` whose only
  fixes are in Next 16. They are pinned by staying on Next 14.
