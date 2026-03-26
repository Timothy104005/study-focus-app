# Demo Runbook

Updated: 2026-03-26

This runbook matches the latest local smoke pass. It is intentionally strict about what is safe to show and what is still blocked.

## Preferred Local Commands

Use a non-default Next build directory in this Windows OneDrive workspace:

```powershell
$env:NEXT_DIST_DIR=".next-qa-build"
npm run build
npm run start -- --port 3011
```

Then open:

- `http://localhost:3011/login`
- `http://localhost:3011/groups`
- `http://localhost:3011/leaderboard`
- `http://localhost:3011/exams`
- `http://localhost:3011/profile`

## What Is Safe To Demo Locally Right Now

- Login request UI: enter an email and reach the "check your inbox" state.
- Groups: join an existing group with `MOCK11`.
- Groups: create a new group from the modal.
- Group detail: create and view a discussion post.
- Leaderboard: switch between Daily and Weekly.
- Exams: create, edit, and delete a custom exam.
- Profile: review totals, recent sessions, and the 7-day chart.

## What To Avoid In A Local No-Env Demo

- Do not use `/focus` as part of the MVP demo.
- Do not claim that real email auth has been verified end to end.

Current blocker:

- `/focus` calls `GET /api/v1/study-sessions?openOnly=true`.
- Without Supabase env values, that route returns `500`.
- `qa-start-3011.err.log` records the server-side cause as missing Supabase environment variables.

## Recommended Demo Sequence

1. Open `/login`.
2. Submit a test email such as `qa-smoke@example.com`.
3. Confirm the UI reaches the "check your inbox" state.
4. Open `/groups`.
5. Join `MOCK11`.
6. Create a new group.
7. Open that group and publish one discussion post.
8. Open `/leaderboard` and toggle from Daily to Weekly.
9. Open `/exams` and run create, edit, then delete on a custom exam.
10. Open `/profile` and review the summary cards plus recent sessions.

## Current Seeded Group Codes

- `DAAN3A`
- `MOCK11`

## If You Need A Real End-To-End Pass

Before re-testing real auth and focus sessions, add a working `.env.local` with:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3011
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

After that:

1. Rebuild with `NEXT_DIST_DIR=.next-qa-build`.
2. Re-run the login magic-link callback.
3. Re-run `/focus` start, pause, resume, blur, and stop.
4. Confirm the saved session affects leaderboard and profile data in the intended environment.

## Quick Reality Check

- Local mock-mode smoke is now strong for groups, leaderboard, exams, discussion, and profile.
- Focus timer is still the main blocker for an honest MVP acceptance signoff.
