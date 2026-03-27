# Demo Runbook

Updated: 2026-03-27  
Branch: `fix/mvp-stabilization`

This runbook is the safest branch-level sequence for showing the current MVP **without** relying on a full Supabase stack first.

## Preferred MVP Smoke Setup

Use mock mode first.

### Minimal `.env.local`

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_STUDY_FOCUS_DATA_SOURCE=mock
NEXT_PUBLIC_STUDY_FOCUS_API_BASE_URL=/api
```

Then run:

```bash
npm install
npm run dev
```

Open:

- `http://localhost:3000/login`
- `http://localhost:3000/focus`
- `http://localhost:3000/groups`
- `http://localhost:3000/leaderboard`
- `http://localhost:3000/exams`
- `http://localhost:3000/profile`

## Safe Demo Scope In Mock Mode

### 1. Login
- Use any email/password pair.
- Mock mode now skips real Supabase auth and enters the app flow directly.

### 2. Focus
- Start a session.
- Pause it.
- Resume it.
- Stop it.
- Switch tabs briefly and return to confirm the interruption-safe flow is not obviously broken.

### 3. Groups
- Review joined groups.
- Create a new group.
- Join an existing group with a valid invite code from seeded/mock data if available.

### 4. Group detail / discussion
- Open a group.
- Publish one discussion post.
- Confirm it appears immediately in the list.

### 5. Leaderboard
- Open daily leaderboard.
- Switch to weekly leaderboard.
- Switch group selector if multiple groups exist.

### 6. Exams
- Create one custom exam.
- Edit it.
- Delete it.
- Confirm shared/group exams still show as read-only.

### 7. Profile
- Review summary cards.
- Review the 7-day chart.
- Review recent sessions.

## What This Runbook Does **Not** Prove

- Real Supabase auth correctness
- Real backend persistence across all routes
- Real `/api/*` and `/api/v1/*` integration under production env
- Full bilingual switching behavior

## Real Backend Verification Pass

After mock-mode smoke is clean, switch to real API mode.

### Required env additions

```env
NEXT_PUBLIC_STUDY_FOCUS_DATA_SOURCE=api
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Then:

1. Seed the backend if needed.
2. Re-run login with a real account.
3. Re-run focus start/pause/resume/stop.
4. Check whether focus completion affects leaderboard and profile as expected.
5. Re-run group, discussion, and exam flows under the real backend path.

## Honest Acceptance Note

This rescue branch is designed to make the MVP safer to demo and less brittle without doing a redesign.  
Final acceptance should still include one real env-backed browser pass before merge.
