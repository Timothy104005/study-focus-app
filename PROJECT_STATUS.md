# Project Status

Updated: 2026-03-27  
Branch: `fix/mvp-stabilization`

## Current Repo Summary

- Next.js 15 App Router application with frontend pages and backend routes in one repo.
- Real auth/data path is still Supabase-backed.
- Most screens still read through the legacy `/api/*` shell adapter.
- Focus session lifecycle uses newer `/api/v1/*` routes.
- The repo now has an explicit mock-mode stabilization path for login and focus-session smoke runs.

## What Was Audited In This Pass

The following flows were inspected against the current repo state:

- login
- focus timer
- daily leaderboard
- weekly leaderboard
- groups / class membership
- exam countdown CRUD
- discussion board
- profile stats
- zh-TW / en copy consistency

## Broken Or Inconsistent Flows Found

### 1. Login
- The current login page uses direct Supabase email/password calls.
- In local mock-mode smoke runs, login still tried to hit real Supabase and could fail even when the rest of the frontend was intended to run in mock mode.

### 2. Focus timer
- The page called `/api/v1/study-sessions?openOnly=true` directly, even when the app was in mock mode.
- The UI exposed start/resume/stop, but **pause** was missing even though the v1 API supports it.
- The page had no safe interruption reporting wiring, despite the API supporting interruption events.
- The mobile sidebar navigation was duplicated/inconsistent.

### 3. Documentation drift
- `README.md` still described the older magic-link auth path.
- `DEMO_RUNBOOK.md` and `MVP_CHECKLIST.md` described focus as blocked in local smoke mode, which was true before stabilization but no longer matches the intended rescue-branch behavior.

### 4. Copy consistency
- Global navigation labels had shifted into mixed hardcoded English while the rest of the product remained predominantly zh-TW.
- I did not find a real end-to-end language-switch system in the currently inspected routes, so bilingual switching cannot be claimed as verified.

## Fixes Applied In This Branch

### Login stabilization
- Added a mock-mode login fallback.
- When `NEXT_PUBLIC_STUDY_FOCUS_DATA_SOURCE=mock`, login/register now bypass real Supabase calls and redirect into the MVP flow instead of failing on missing backend auth config.

### Focus stabilization
- Added a mock-backed v1 study-session service for:
  - open session bootstrap
  - start
  - pause
  - resume
  - stop
  - interruption reporting
  - flag for review
- Updated the focus page to:
  - support pause
  - keep stop behavior
  - handle interruption reporting more safely
  - show a better empty state when no group is available
  - remove the duplicated sidebar entry
  - keep current product structure without a major redesign

### Documentation
- Updated `README.md`
- Updated `MVP_CHECKLIST.md`
- Updated `DEMO_RUNBOOK.md`

## Flow Status After Rescue-Branch Changes

| Flow | Code Status | Runtime Confidence | Notes |
| --- | --- | --- | --- |
| Login | Improved | Medium | Mock mode is now explicitly supported; real Supabase auth still needs env-backed verification |
| Focus timer | Improved | Medium | Mock mode now has start/pause/resume/stop + interruption support in code |
| Daily leaderboard | Stable | Medium | No blocker found in page logic during this pass |
| Weekly leaderboard | Stable | Medium | No blocker found in page logic during this pass |
| Groups / membership | Stable | Medium | Create/join/detail flows remain intact |
| Exam countdown CRUD | Stable | Medium | Custom exam CRUD remains intact |
| Discussion board | Stable | Medium | Group detail posting/moderation flow remains intact |
| Profile stats | Stable | Medium | Rendering and summary flow remain intact |
| zh-TW / en switching | Partial | Low | Copy consistency improved a bit, but true language switching still needs a dedicated pass |

## Remaining Blockers

- Real Supabase-backed auth still needs live verification with working env vars.
- Real `/api/*` and `/api/v1/*` interoperability still needs one honest end-to-end pass outside mock mode.
- Full bilingual switching is **not** verified from the currently inspected code paths.
- This pass was code-level stabilization; I did not run a full local browser smoke test in this environment.

## Safest Next Step

1. Run the branch in `mock` mode and do a browser smoke pass over login, focus, groups, leaderboard, exams, discussion, and profile.
2. Then switch to real `api` mode with valid Supabase env vars and re-run the same flow.
3. Only after that, decide whether any remaining `/api/*` vs `/api/v1/*` mismatches need surgical fixes before demo acceptance.
