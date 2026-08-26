# Quick Tenders

Tender matching for companies. Next.js 14 (App Router) + TypeScript + Tailwind
CSS, with Supabase for auth, Postgres and storage.

This is scaffolding only — schema, typed Supabase clients, and folder structure.
There is no product UI yet.

## Setup

```bash
npm install
cp .env.local.example .env.local   # then fill in your project values
npm run dev
```

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` come from
**Project Settings → API** in the Supabase dashboard. Both are public by design;
row level security, not key secrecy, is what keeps tenants apart.

Without `.env.local` the app still boots — the middleware logs a warning and
skips session refresh, and the client factories throw on first use.

## Applying the schema

`supabase/migrations/0001_init.sql`. Either paste it into the dashboard SQL
editor, or use the CLI:

```bash
supabase init          # only if you want the local stack; writes supabase/config.toml
supabase link --project-ref <your-project-ref>
supabase db push
```

If your CLI version rejects the `0001_` prefix, rename the file to a 14-digit
timestamp prefix (e.g. `20260101000000_init.sql`).

## Layout

```
app/                      App Router root (bare shell for now)
lib/env.ts                Reads + validates the two NEXT_PUBLIC_ vars
lib/supabase/client.ts    Typed client for Client Components
lib/supabase/server.ts    Typed client for Server Components / Actions / Routes
lib/supabase/middleware.ts  Auth token refresh, used by middleware.ts
middleware.ts             Keeps the auth session fresh on every request
types/database.ts         Schema types, `supabase gen types` shape
types/index.ts            Convenience aliases — import from `@/types`
supabase/migrations/      SQL migrations
```

Pick the client by where the code runs:

```ts
// Server Component, Server Action, Route Handler — one per request
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

`companies.trial_ends_at` is set to `trial_started_at + 3 days` on insert by the
`companies_set_trial_window` trigger, unless you pass a value explicitly.

`tenders_matched.status` is constrained to `new` / `reviewed` / `submitted` /
`expired`. The union lives in `types/database.ts` and its runtime counterpart is
`TENDER_STATUSES` in `types/index.ts`.

## Row level security

RLS is on for all four tables, and `anon` has no grants — everything is behind a
login. Each policy resolves the caller's company through
`public.current_company_id()`, which looks up `auth.uid()` in `representatives`.
It is `SECURITY DEFINER` so it can read that table without re-entering its own
policies, which would recurse. `tender_documents` authorises through its parent
tender via `public.tender_belongs_to_current_company()`.

Two things worth knowing before you build onboarding:

- **An authenticated user cannot insert a company.** Before their
  `representatives` row exists, `current_company_id()` is null, so no insert
  passes the check. Create the company and the representative row together from
  a trusted server context using the service role key, or add a
  `SECURITY DEFINER` RPC that does both.
- **A representative can read their own row even with a null `company_id`**, so
  a user who is not yet attached to a company is not locked out of themselves.
  Writes stay company-scoped only — allowing self-writes would let a user
  attach themselves to any company.

## Regenerating types

`types/database.ts` is hand-written to match the migration. Once a project is
linked you can regenerate it:

```bash
npm run db:types
```

The generator widens the `status` check constraint to `string`; re-narrow it to
`TenderStatus` afterwards.

## Notes

- `npm audit` reports advisories in `next` and `eslint-config-next` whose only
  fixes are in Next 16. They are pinned by staying on Next 14.
