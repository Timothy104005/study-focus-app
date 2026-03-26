# Project Status

Updated: 2026-03-26

## Current Repo Summary

- Next.js 15 App Router application with frontend pages and backend routes in one repo.
- Supabase is the real auth and data backend.
- The frontend still relies on a legacy `/api/*` shell adapter for most screens.
- Focus and Exam flows also call newer `/api/v1/*` endpoints directly.
- Database schema lives in `supabase/migrations`.
- Demo seed data lives in `scripts/seed.ts`.

## What Is Complete In Code

- Login request route and auth callback route exist.
- Group list, create, join, detail, presence, and leaderboard backend services exist.
- Study session lifecycle exists in `/api/v1/study-sessions` with create, pause, resume, stop, interrupt, and flag-for-review.
- Exam countdown backend supports list, create, read, update, and delete.
- Discussion backend supports list, create, update, report, hide, and delete.
- Profile bootstrap and profile-stat aggregation exist.
- A seeded demo dataset exists with users, a group, study sessions, exams, and posts.

## What Was Verified In This Acceptance Pass

- `npm run build` passes.
- A runnable production build can be produced with `NEXT_DIST_DIR=.next-local`.
- `/login` renders, but submitting the login form currently returns `500` in this workspace because required Supabase env vars are missing.
- `/`, `/focus`, `/leaderboard`, `/groups`, `/exams`, and `/profile` all currently render an error state in this workspace because their backing API routes return `500` without Supabase env.
- The QA smoke script was stale and has now been updated to match the current UI, required fields, and seeded invite code.
- Broken group-detail moderation/session notices have been repaired with readable fallback copy.

## Flow Status

| Flow | Implementation | Live Verification In This Pass | Current Status |
| --- | --- | --- | --- |
| Login | Route + callback implemented | Rendered form; submit hit `500` without Supabase env | Partial |
| Focus timer | UI + v1 session lifecycle implemented | Page load blocked by backend env; no successful timer run | Partial |
| Daily/weekly leaderboard | UI + backend RPC aggregation implemented | Page load blocked by backend env | Partial |
| Groups/class membership | UI + create/join/detail backend implemented | Page load blocked by backend env | Partial |
| Exam countdown CRUD | UI list/create/edit/delete for custom exams + v1 CRUD backend | Page load blocked by backend env | Partial |
| Group discussion board | UI list/create/report/hide/remove + backend support | Group detail could not be reached live because groups failed earlier | Partial |
| Profile stats | UI + aggregation backend implemented | Page load blocked by backend env | Partial |

## Broken, Inconsistent, Or Still Mock-Adjacent

- No `.env.local` was present during verification.
- `supabase` CLI and `docker` were not available in PATH in this workspace.
- All authenticated API flows currently hard-fail locally with missing Supabase env.
- `next dev` is not reliable in this Windows OneDrive workspace when using the default `.next` directory.
- The frontend is split across legacy `/api/*` and newer `/api/v1/*` contracts.
- Focus and Exams are the highest-risk screens because they mix both API surfaces in one page.
- Shared/group exams are still not full CRUD from the current frontend.
- Existing release/demo docs were more optimistic than the evidence collected in this pass.

## Safest Next Step Toward A Demo-Ready MVP

1. Restore a real Supabase-backed local or staging environment and verify auth first.
2. Re-run the smoke flow against seeded data with the updated `scripts/qa-smoke.mjs`.
3. Only after real auth works, close any flow-specific bugs found in Focus, Leaderboard, Exams, and Groups.
4. Defer route-surface consolidation until after the demo, unless a specific `/api/*` to `/api/v1/*` mismatch is causing a confirmed bug.

## Owner Split

- Frontend
  Mixed legacy/v1 data access on Focus and Exams, plus remaining UI-only assumptions.
- Backend
  Requires working Supabase env, auth session, and seeded data before any real acceptance run.
- Shared contract
  Legacy shell contract and v1 DTO contract both remain active, which increases mismatch risk.
- QA/deploy
  Need a reproducible environment with Supabase configured, seeded data loaded, and a stable non-OneDrive build/output path when running locally on Windows.
