# Study Focus App

Study Focus is a Next.js App Router app for a study-focus MVP. It uses Supabase for Auth, Postgres, and Realtime-friendly presence support, and includes a frontend shell plus backend routes in the same repo.

For the full demo and release checklist, use [DEMO_RUNBOOK.md](./DEMO_RUNBOOK.md).

## What Is In This Repo

- Next.js App Router frontend and backend in one project
- Supabase-backed auth callback flow with magic-link sign-in
- Database schema and RPCs under `supabase/migrations`
- Frontend-compatible routes under `src/app/api/*`
- Granular backend routes under `src/app/api/v1/*`
- Demo seed script under `scripts/seed.ts`

## Prerequisites

- Node.js `>= 20.11`
- npm `>= 11`
- Docker Desktop running for local Supabase
- Supabase CLI installed for local database setup and migrations

## Quick Start

1. Copy `.env.example` to `.env.local`.
2. Install dependencies with `npm install`.
3. Start local Supabase with `supabase start`.
4. Apply schema with `supabase db reset`.
5. Copy the local Supabase URL, anon key, and service-role key from `supabase status` into `.env.local`.
6. Seed demo data with `npm run seed`.
7. Start the app with `npm run dev`.
8. Open `http://localhost:3000`.

## Environment Variables

- `NEXT_PUBLIC_APP_URL`
  Use `http://localhost:3000` locally and your real production URL in deployment.
- `NEXT_PUBLIC_SUPABASE_URL`
  Local default is usually `http://127.0.0.1:54321`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  Required for browser auth and API access.
- `NEXT_PUBLIC_STUDY_FOCUS_DATA_SOURCE`
  Keep this as `api` for demo and release.
- `NEXT_PUBLIC_STUDY_FOCUS_API_BASE_URL`
  Keep this as `/api`.
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
3. In Supabase Auth settings, add your deployed callback URL:
   `https://your-domain.example/auth/callback`
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

- The frontend is wired to the real backend/API flow by default.
- If you explicitly want the mock frontend adapter, set `NEXT_PUBLIC_STUDY_FOCUS_DATA_SOURCE=mock`.
- Group/shared exams are still list-only from the frontend; personal custom exams support full CRUD.
- Presence is currently snapshot-backed in the UI rather than a full realtime subscription experience.
