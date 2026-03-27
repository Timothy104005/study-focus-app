# Study Focus App

Study Focus is a Next.js App Router app for a study-focus MVP. It keeps the frontend shell and backend routes in one repo, uses Supabase for the real auth/data path, and also supports a mock-mode frontend pass for local MVP stabilization work.

For the current smoke path and demo boundaries, use [DEMO_RUNBOOK.md](./DEMO_RUNBOOK.md).

## What Is In This Repo

- Next.js App Router frontend and backend in one project
- Email/password auth UI backed by Supabase in real API mode
- Mock-mode frontend fallback for local MVP smoke runs
- Database schema and RPCs under `supabase/migrations`
- Frontend-compatible routes under `src/app/api/*`
- Granular backend routes under `src/app/api/v1/*`
- Demo seed script under `scripts/seed.ts`

## Prerequisites

- Node.js `>= 20.11`
- npm `>= 11`

For the real backend path you also need:

- Docker Desktop running for local Supabase
- Supabase CLI installed for local database setup and migrations

## Quick Start

### A. Fast MVP smoke run without Supabase

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_STUDY_FOCUS_DATA_SOURCE=mock`.
3. Install dependencies with `npm install`.
4. Start the app with `npm run dev`.
5. Open `http://localhost:3000/login`.

### B. Real backend run with Supabase

1. Copy `.env.example` to `.env.local`.
2. Install dependencies with `npm install`.
3. Start local Supabase with `supabase start`.
4. Apply schema with `supabase db reset`.
5. Copy the local Supabase URL, anon key, and service-role key from `supabase status` into `.env.local`.
6. Set `NEXT_PUBLIC_STUDY_FOCUS_DATA_SOURCE=api`.
7. Seed demo data with `npm run seed`.
8. Start the app with `npm run dev`.
9. Open `http://localhost:3000`.

## Environment Variables

- `NEXT_PUBLIC_APP_URL`
  Use `http://localhost:3000` locally and your real production URL in deployment.
- `NEXT_PUBLIC_SUPABASE_URL`
  Required for real browser auth and API access.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  Required for real browser auth and API access.
- `NEXT_PUBLIC_STUDY_FOCUS_DATA_SOURCE`
  Use `mock` for local MVP smoke runs, `api` for the real backend path.
- `NEXT_PUBLIC_STUDY_FOCUS_API_BASE_URL`
  Keep this as `/api` for the current shell adapter.
- `SUPABASE_SERVICE_ROLE_KEY`
  Required for `npm run seed`. Do not expose it to the client.

## Build And Run

- Local dev: `npm run dev`
- Typecheck: `npm run typecheck`
- Production build: `npm run build`
- Production serve: `npm run start`
- Release verification: `npm run release:check`

The app builds as a normal Next.js application, so any platform that supports `next build` and `next start` can run it.

## Recommended Deployment Flow

Recommended path: Vercel for the app, hosted Supabase for the backend services.

1. Create or choose a hosted Supabase project.
2. Apply migrations with `supabase link` and `supabase db push`.
3. In Supabase Auth settings, configure the deployed app URL used by the email/password flow.
4. Create a Vercel project from this repo.
5. Set the production env vars from `.env.example`.
6. Deploy with the default Next.js build flow.

For non-Vercel Node hosting, the minimal release flow is still:

1. Provide the same production env vars.
2. Run `npm install`.
3. Run `npm run build`.
4. Run `npm run start`.

## Demo Data

`npm run seed` creates a clean demo-ready group with members, leaderboard-worthy study sessions, exam countdowns, and discussion posts.

- Demo invite code: `BIO101A1`
- Demo emails: `owner@example.com`, `member1@example.com`, `member2@example.com`

## Notes

- The frontend still spans both the legacy `/api/*` shell adapter and newer `/api/v1/*` routes.
- Mock mode is intended for MVP UI smoke passes, not backend acceptance.
- Group/shared exams are still list-only from the frontend; personal custom exams support full CRUD.
- Presence is currently snapshot-backed in the UI rather than a full realtime subscription experience.
- zh-TW copy is still the dominant UI language; a dedicated i18n pass is still needed before claiming full bilingual switching support.
