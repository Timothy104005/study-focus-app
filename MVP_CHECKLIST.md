# MVP Checklist

Updated: 2026-03-27  
Branch: `fix/mvp-stabilization`

Status legend:

- `[x]` code path stabilized in this branch
- `[~]` partially stabilized or still needs runtime verification
- `[ ]` still blocked

## QA Baseline

- `[~]` Branch-level code inspection completed.
- `[ ]` Full browser smoke pass executed on this branch.
- `[ ]` Real Supabase-backed end-to-end pass executed on this branch.

## Login

- `[x]` `/login` renders the email/password form.
- `[x]` Mock mode can bypass real Supabase auth for MVP smoke runs.
- `[~]` Real email/password login still needs env-backed verification.
- `[~]` Real registration still needs env-backed verification.

## Focus Timer

- `[x]` `/focus` has a mock-capable v1 session service.
- `[x]` Start flow exists in both page logic and mock v1 service.
- `[x]` Pause flow now exists in the page.
- `[x]` Resume flow exists.
- `[x]` Stop flow exists.
- `[x]` Basic interruption reporting is now wired in the page.
- `[~]` Full browser verification of start/pause/resume/stop is still pending.
- `[~]` Real Supabase-backed v1 session verification is still pending.

## Daily / Weekly Leaderboard

- `[x]` Daily leaderboard route and toggle logic remain intact.
- `[x]` Weekly leaderboard route and toggle logic remain intact.
- `[~]` Browser smoke verification on this branch is still pending.

## Groups / Class Membership

- `[x]` Group list flow remains intact.
- `[x]` Create group flow remains intact.
- `[x]` Join group flow remains intact.
- `[x]` Group detail route remains intact.
- `[~]` Browser smoke verification on this branch is still pending.

## Exam Countdown CRUD

- `[x]` Exam countdown list flow remains intact.
- `[x]` Custom exam create remains intact.
- `[x]` Custom exam edit remains intact.
- `[x]` Custom exam delete remains intact.
- `[x]` Shared / group exams remain read-only.
- `[~]` Browser smoke verification on this branch is still pending.

## Discussion Board

- `[x]` Group discussion composer remains intact.
- `[x]` Group discussion posting remains intact.
- `[x]` Report / hide / remove actions remain wired.
- `[~]` Browser smoke verification on this branch is still pending.

## Profile Stats

- `[x]` Profile summary route remains intact.
- `[x]` Trend chart and recent sessions remain intact.
- `[~]` Browser smoke verification on this branch is still pending.

## i18n / Copy Consistency

- `[x]` Rescue-branch navigation copy is back to consistent zh-TW labels.
- `[~]` Full zh-TW / en switching is not verified from the currently inspected routes.
- `[ ]` Dedicated i18n switch pass has not been completed.

## Current Acceptance View

- `[x]` The rescue branch now targets MVP stabilization, not redesign.
- `[x]` Focus is no longer structurally blocked in mock mode.
- `[~]` Real backend verification is still required before final acceptance.
- `[~]` Language-switch acceptance is still not ready to claim.
