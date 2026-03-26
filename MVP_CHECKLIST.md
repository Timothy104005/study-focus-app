# MVP Checklist

Updated: 2026-03-26

Status legend:

- `[x]` verified in the latest local smoke pass
- `[~]` partially verified or UI-only
- `[ ]` blocked or still failing

## QA Baseline

- `[x]` `npm run typecheck` passes.
- `[x]` `NEXT_DIST_DIR=.next-qa-build npm run build` passes.
- `[x]` Local smoke run completed against `http://localhost:3011`.

## Login

- `[x]` `/login` renders the email form.
- `[x]` Submitting an email reaches the "check your inbox" success state.
- `[~]` Login request flow is smoke-tested in mock mode.
- `[ ]` Real magic-link callback is verified end to end.

## Focus Timer

- `[ ]` `/focus` loads the timer controls.
- `[ ]` Start, pause, resume, and stop are verified.
- `[ ]` Tab blur / visibility interruption tracking is verified.
- `[ ]` Focus timer is demo-safe in local mock mode.

Current blocker:

- `[ ]` `GET /api/v1/study-sessions?openOnly=true` returns `500`.
- `[ ]` Server log points to missing Supabase env values while the page still depends on the v1 study-session API.

## Daily / Weekly Leaderboard

- `[x]` Daily leaderboard renders.
- `[x]` Weekly leaderboard toggle renders and updates the ranking list.
- `[x]` Group selector renders current seeded groups.

## Groups / Class Membership

- `[x]` Joined an existing group with invite code `MOCK11`.
- `[x]` Created a new group (`QA 3011 Group`) from the UI.
- `[x]` Group detail page opens for the new group.
- `[x]` Join-code example text now matches current seeded data (`DAAN3A`).

## Exam Countdown CRUD

- `[x]` Exam countdown list renders.
- `[x]` Custom exam create works in local mock mode.
- `[x]` Custom exam edit works in local mock mode.
- `[x]` Custom exam delete works in local mock mode.
- `[x]` Shared / group exams remain read-only.

## Discussion Board

- `[x]` Group discussion composer renders.
- `[x]` Posting from group detail succeeds.
- `[x]` The new post appears immediately in the discussion list.

## Profile Stats

- `[x]` Profile summary renders.
- `[x]` 7-day trend renders.
- `[x]` Recent sessions list renders.

## Console / Build Notes

- `[x]` No new build errors after the latest fixes.
- `[x]` No blocking console errors were observed on login, leaderboard, groups, exams, discussion, or profile.
- `[~]` A missing `/favicon.ico` can still appear as low-priority console noise on a fresh page load.

## Current Acceptance View

- `[x]` Leaderboard, groups, exams, discussion, and profile are smoke-passable locally.
- `[~]` Login is acceptable only as a UI/request-flow smoke pass.
- `[ ]` Focus timer remains the main MVP blocker for a truthful end-to-end acceptance signoff.
