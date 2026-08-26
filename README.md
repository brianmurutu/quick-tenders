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
- `0005_tender_discovery.sql`: `procuring_entity`, plus the unique index on
  `(company_id, source_url)` that makes the discovery job idempotent.
- `0006_tender_drafting.sql`: `notified_at`, one document per type per tender, the
  private `tender-documents` Storage bucket and its read policy, and the drafting
  work queue.

If your CLI version rejects the `0001_` prefix, rename all of them to 14-digit
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
app/dashboard/tenders/[id]/ Tender detail, documents, and the status actions
app/upgrade/                Where the trial gate sends an expired account
app/api/cron/               Scheduled jobs: discovery, and document drafting
app/api/documents/[id]/     Signed download redirect for one drafted document
components/                 Shared header, footer, content page shell, app header
lib/env.ts                  Reads and validates the environment
lib/cron-auth.ts            Shared bearer-token check for the cron endpoints
lib/company-profile.ts      Industry, sector, county and size lists, plus validation
lib/document-types.ts       Document types, Storage layout, download filenames
lib/docx.ts                 Minimal DOCX writer, no dependencies
lib/email/                  Resend client and the tender notification template
lib/signup.ts               Signup fields, validation, and status parsing
lib/tender-sources/         One file per tender source, behind a shared interface
lib/tender-matching.ts      Anthropic relevance scoring
lib/tender-discovery.ts     The discovery run
lib/tender-drafting.ts      Anthropic document drafting
lib/tender-documents.ts     The drafting run: store, record, notify
lib/tender-status.ts        Dashboard bucketing, date phrasing, id validation
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

`SUPABASE_SERVICE_ROLE_KEY` is required by the scheduled jobs only, via
`lib/supabase/admin.ts`, which bypasses RLS because it reads and writes across
every tenant. It has no `NEXT_PUBLIC_` prefix so it never reaches a bundle, and
the factory throws if it is ever called in a browser. Do not import it from
anything a request can reach.

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

## Scheduled jobs

Two cron endpoints, both authorised by `CRON_SECRET` presented as
`Authorization: Bearer <secret>` (what Vercel Cron sends) or `X-Cron-Secret`.
Both **fail closed**: an unset `CRON_SECRET` shuts the endpoint rather than
opening it. `vercel.json` holds the schedules; Supabase `pg_cron` with `pg_net`,
GitHub Actions, or anything that can send a header works equally well. Both
accept `?dry_run=true`, and return **207** when the run happened but something
inside it failed, so a scheduler can tell partial from total failure.

### `/api/cron/discover-tenders`

Fetches from every enabled source, scores each tender per company against its
profile, and inserts anything at or above the threshold.

Sources live in `lib/tender-sources/`, one file each, behind a shared interface.
Adding one is a file plus a line in `ALL_SOURCES`. What each one does today, and
why:

| Source | robots.txt | State |
| --- | --- | --- |
| `ppip` | Permits everything (`Disallow:` empty) | CSV import. tenders.go.ke renders listings client side, so there is no reliable markup to parse. Set `PPIP_CSV_PATH` or `PPIP_CSV_URL`. |
| `county-nairobi` | Could not be fetched | **Stubbed.** TLS certificate chain does not verify. Not bypassed. |
| `county-kiambu` | Permits crawling | **Stubbed.** WP REST API returns 401. Not bypassed. |
| `county-nakuru` | Permits crawling | Implemented against the public WP REST API, but **ships disabled**: tender notices were not found in `posts` or `media`. |
| `mock` | n/a | Fixtures. On outside production, off inside it. |

Every source appears in the run summary with a status and a reason, so a blocked
or unconfigured source is visible rather than looking like a quiet zero. One
source failing never fails the run.

`TENDER_SOURCES` selects which run. Unset means every real source, plus `mock`
outside production.

### `/api/cron/draft-documents`

Drafts a cover letter and a technical proposal skeleton per new match, stores
them as DOCX in Supabase Storage, records a `tender_documents` row each, and
emails the representative through Resend.

**This is a separate scheduled job rather than being chained onto the matching
insert.** Discovery scores 20 tenders in one model call; drafting is two model
calls, two DOCX builds, two uploads and an email *per match*, so bolting it on
would blow the function timeout and take the matching down with it. The queue is
`pending_tender_drafts()`, which returns matches with no documents **or** no
`notified_at`, so it is derived from state rather than from remembering an event:
anything that failed halfway is retried automatically, with no dead letter queue.
The trade is latency, since a match waits for the next tick. The full reasoning is
at the top of `lib/tender-documents.ts`.

DOCX rather than PDF because these are drafts a representative has to **edit**
before submitting. `lib/docx.ts` writes the package directly with `node:zlib`
(`deflateRawSync` plus `crc32`), so there is no new dependency.

Every generated document opens with a DRAFT banner, and the prompt forbids
inventing anything factual: no certifications, registrations, past contracts,
turnover or prices. Anything only the company can supply comes back as a
bracketed placeholder. A draft that invented an NCA registration would be worse
than no draft, because somebody might submit it.

Documents are stored at `company_id/tender_id/doc_type.docx` in a **private**
bucket. The read policy checks the first path segment against
`current_company_id()`, so one company cannot read another draft bid. There is no
insert, update or delete policy for `authenticated`: the job writes with the
service role, and representatives download rather than replace.

The email link points at `/dashboard/tenders/[id]`, which the dashboard now
serves.

## The dashboard

`/dashboard` lists the matched tenders for the signed-in representative company,
soonest deadline first, with tenders that have no deadline sorting last rather
than crowding the top. Every query is scoped by RLS, so none of them carries a
company filter of its own.

`?status=` filters the list: All, New, Reviewed, Submitted, Expired. Tabs are
plain links, so the page stays a Server Component with no client JS, and a
filtered view is shareable. The whole set is fetched once (capped at 500) and
bucketed in memory, which is what makes the tab counts exact without five extra
queries.

### Buckets are derived, and mutually exclusive

`lib/tender-status.ts` decides which single tab a tender belongs to:

| Bucket | Rule |
| --- | --- |
| Submitted | `status = 'submitted'`, whatever the deadline says |
| Expired | `status = 'expired'`, **or** the deadline has passed and it is not submitted |
| Reviewed | `status = 'reviewed'` and not past its deadline |
| New | `status = 'new'` and not past its deadline |

Two decisions in there. A submitted tender stays under Submitted once its
deadline passes, because you did the work and it should not vanish into Expired.
And a tender still marked new whose deadline has gone is shown as Expired,
because nothing in the pipeline writes `status = 'expired'` yet: without the
derived rule the Expired tab would always be empty and closed tenders would sit
in New forever. If a job starts writing that status later, the rule still holds.

The counts are unit tested to sum to the total, so nothing is double counted or
dropped.

### Status transitions

Opening a tender detail page moves it from `new` to `reviewed`. That write happens
in a **client effect calling a Server Action**, not during the server render: a
Server Component render is not a user action, Next can render a route to satisfy a
link prefetch, and Server Components are meant to be free of side effects. Doing
it in render would mean a tender flipped to reviewed because somebody hovered a
row in the list.

Both transitions guard on the current status in the `WHERE` clause rather than
reading first and then writing:

```sql
update tenders_matched set status = 'reviewed' where id = $1 and status = 'new'
```

So a submitted tender cannot be dragged back to reviewed by a stray call, and two
simultaneous opens cannot fight. Authorisation is left to RLS: an id belonging to
another company matches no row and the update affects nothing, which is the right
outcome and needs no extra query.

### Document downloads

Documents go through `/api/documents/[id]` rather than being linked from Storage
directly. The bucket is private, so each click mints a signed URL valid for 60
seconds and redirects to it; embedding signed URLs in the page HTML would put a
working credential into a document that outlives the view and can be forwarded.

Three layers stand behind a download, and the first two are the ones that matter:
RLS on `tender_documents` means another company document id is indistinguishable
from one that does not exist; the Storage policy means `createSignedUrl` cannot
sign an object outside the caller company; and the trial gate is repeated here
because a route handler is not inside the dashboard layout.

A tender id that is not a uuid is rejected before it reaches Postgres, which
would otherwise raise on the comparison instead of returning no rows. A tender
that is not yours 404s rather than 403s, so the response does not confirm the row
exists.

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
