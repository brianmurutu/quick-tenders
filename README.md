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
components/                 Shared header, footer, content page shell
lib/env.ts                  Reads and validates the environment
lib/signup.ts               Signup field definitions and validation
lib/url.ts                  Open redirect guard for ?next=
lib/supabase/client.ts      Typed client for Client Components
lib/supabase/server.ts      Typed client for Server Components / Actions / Routes
lib/supabase/middleware.ts  Auth token refresh, used by middleware.ts
types/database.ts           Schema types, `supabase gen types` shape
types/index.ts              Convenience aliases, import from `@/types`
supabase/migrations/        SQL migrations
```

Routes: `/`, `/signup`, `/about`, `/contact`, `/careers`, `/privacy`, `/terms`,
`/security`, and the `/auth/callback` handler.

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

1. The form collects name, company email, password, company name, industry,
   region and size. `lib/signup.ts` validates it, and the same function runs
   again inside the server action, since a crafted request can send anything.
2. The action calls `company_domain_status(domain)` before creating anything, so
   a company that already has an account, or a consumer email provider, is
   rejected up front rather than after the user has confirmed their email.
3. `auth.signUp` is called with the company details in user metadata, so nothing
   needs storing between signup and confirmation.
4. The confirmation link lands on `/auth/callback`, which exchanges it for a
   session and then calls `complete_onboarding()`.
5. That RPC creates the `companies` and `representatives` rows together, taking
   the domain from the **verified** email address rather than any form field. It
   is idempotent, so confirming twice does not create a second company.

On success the callback redirects to `/`. Point it at a dashboard once one
exists, via the `next` query parameter (guarded by `lib/url.ts`).

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
