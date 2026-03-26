# Release Candidate

## Current verification

- `npm run typecheck` passes.
- `npm run build` passes.
- The default frontend release path now uses the same-origin API unless `NEXT_PUBLIC_STUDY_FOCUS_DATA_SOURCE=mock` is set.
- A browser smoke script exists at `scripts/qa-smoke.mjs`, but it still needs to be run against a live demo environment with seeded data.

## What works

- Email sign-in request and callback flow work through Supabase.
- Profiles are created automatically on first authenticated access.
- The app renders the core demo pages: home, focus, leaderboard, groups, exams, and profile.
- Focus sessions support create, pause, resume, stop, and interruption reporting through the v1 backend.
- Exams support create, update, and delete from the UI.
- Groups can be created, joined, and viewed.
- Discussion posts can be listed and created.
- Profile stats and leaderboard summaries render from backend data.

## What is risky

- The app still uses two API surfaces: legacy `/api/*` and granular `/api/v1/*`.
- Some frontend screens still depend on legacy adapter shapes while focus and exams already use v1 flows.
- Demo success depends on correct Supabase env vars, auth redirect URLs, database migrations, and seeded data.
- There is no automated CI release gate yet; the smoke script is manual.
- Presence and leaderboard behavior should be rechecked in a multi-user demo because they depend on real backend state, not static fixtures.

## What is still placeholder

- First-time onboarding is limited to login plus empty-state guidance; there is no dedicated onboarding flow.
- Discussion post edit/delete exists in the backend but is not exposed in the UI.
- Profile editing exists in the backend but is not exposed in the UI.
- The mock data path still exists for local development and can hide integration issues if used unintentionally.
- Shared product-domain models are richer than the live API DTOs, so not every contract name maps one-to-one yet.

## What must be done before deployment

- Set production or staging env vars from `.env.example`, including `NEXT_PUBLIC_STUDY_FOCUS_DATA_SOURCE=api`.
- Configure Supabase auth redirect URLs for the deployed domain and callback path.
- Apply the Supabase migrations in `supabase/migrations`.
- Seed or manually prepare demo users, groups, exams, and discussion data.
- Run `node scripts/qa-smoke.mjs <app-url>` against the target environment with a browser/CDP session available.
- Dry-run the demo flow: login, create/join group, start/pause/resume/stop focus session, add exam, open leaderboard, and view profile stats.
- Decide whether the release will officially support both `/api/*` and `/api/v1/*`, or whether legacy routes are temporary compatibility only.
