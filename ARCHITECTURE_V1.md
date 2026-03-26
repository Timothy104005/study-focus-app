# Architecture V1

## Intent

This codebase is a web-first study-focus app built as a single Next.js App Router application with Supabase-backed auth, data, and realtime-friendly presence hooks.

The v1 architectural goal is:

- keep the deployable surface as one app
- keep shared transport contracts in one place
- isolate database access behind service modules
- preserve the legacy frontend adapter only as a compatibility layer

## App structure

### Runtime layers

- `src/app`
  - App Router pages, layouts, and route handlers
  - contains both UI routes and HTTP endpoints
- `src/features`
  - screen-level client components
  - should not talk to Supabase directly
- `src/components`
  - reusable UI-only building blocks
- `src/services`
  - frontend HTTP clients and transport selection
- `src/lib/services`
  - backend business logic and data orchestration
- `src/lib/supabase`
  - server, browser, and middleware Supabase wiring
- `src/lib/validation`
  - request validation schemas
- `study-focus-shared/src`
  - shared constants, DTOs, route helpers, and richer domain-model types
- `supabase/migrations`
  - schema, RLS, indexes, and RPC functions

### Architectural split

- Preferred v1 flow:
  - feature -> `@/services/study-focus-v1-api` -> `@/services/api-client` -> `/api/v1/*` route -> `src/lib/services/*` -> Supabase -> mapper -> DTO
- Compatibility flow:
  - feature -> `@/services/study-focus-api` -> `/api/*` route -> `src/lib/services/study-focus-api-adapter.ts` -> backend services

The v1 flow is the long-term path. The compatibility flow exists to keep the MVP UI working while screens migrate.

## Route structure

### UI routes

- `/`
- `/login`
- `/focus`
- `/leaderboard`
- `/groups`
- `/groups/[groupId]`
- `/exams`
- `/profile`
- `/auth/callback`

### Compatibility API routes

These return legacy UI-shaped JSON and exist for the current shell:

- `/api/auth/request-otp`
- `/api/dashboard`
- `/api/focus/overview`
- `/api/focus/sessions`
- `/api/leaderboard`
- `/api/groups`
- `/api/groups/join`
- `/api/groups/[groupId]`
- `/api/groups/[groupId]/posts`
- `/api/exams`
- `/api/profile`

### V1 API routes

These return `{ data: ... }` or `{ error: ... }` and are the release-focused backend surface:

- `/api/v1/auth/email`
- `/api/v1/me`
- `/api/v1/me/presence`
- `/api/v1/study-sessions`
- `/api/v1/study-sessions/[sessionId]/pause`
- `/api/v1/study-sessions/[sessionId]/resume`
- `/api/v1/study-sessions/[sessionId]/stop`
- `/api/v1/study-sessions/[sessionId]/interrupt`
- `/api/v1/groups`
- `/api/v1/groups/join`
- `/api/v1/groups/[groupId]`
- `/api/v1/groups/[groupId]/presence`
- `/api/v1/groups/[groupId]/leaderboard`
- `/api/v1/groups/[groupId]/discussion-posts`
- `/api/v1/discussion-posts/[postId]`
- `/api/v1/exam-countdowns`
- `/api/v1/exam-countdowns/[countdownId]`

## Data model

### Core tables

- `profiles`
  - one row per auth user
  - stores identity, avatar, timezone, and last-seen heartbeat
- `class_groups`
  - study/class groups with owner, slug, and invite code
- `group_members`
  - membership join table with role
- `study_sessions`
  - focus timer sessions with lifecycle timestamps, interruption counters, and integrity status
- `exam_countdowns`
  - personal or group-associated upcoming exams
- `discussion_posts`
  - group-scoped short posts

### Important enums and invariants

- `group_member_role`: `owner | admin | member`
- `study_session_status`: `active | paused | stopped`
- `session_integrity_status`: `clean | warning | flagged`
- `interruption_reason`: `tab_hidden | window_blur | manual`
- one user can have only one open session at a time via the partial unique index on `study_sessions`
- group-scoped data is protected by RLS and helper functions such as `is_group_member`

### Database-side behavior

- profile bootstrap is handled by auth triggers plus server-side fallback upsert
- session lifecycle state transitions are implemented in RPC functions
- group presence and leaderboard summaries are derived by RPCs
- `updated_at` is maintained by triggers

## Shared contracts

### Shared transport contracts

- `study-focus-shared/src/contracts/api.ts`
  - transport DTOs returned by `/api/v1/*`
  - use this for backend-facing TypeScript contracts
- `study-focus-shared/src/contracts/services.ts`
  - route patterns, route builders, and service interfaces aligned to the current v1 HTTP surface

### Shared domain-model contracts

- `study-focus-shared/src/contracts/models.ts`
  - richer product-domain model used mainly by mock data and future-state modeling
  - intentionally broader than the current transport DTO set

### App-local contract barrels

- `src/contracts/index.ts`
  - app-local barrel for shared v1 DTOs and route/service contracts
  - preferred import path inside the Next app for shared transport contracts
- `src/contracts/study-focus.ts`
  - legacy frontend-shell contract
  - now explicitly named around `LegacyStudyFocusApi`
- `src/contracts/shared.ts`
  - local barrel for the broader shared package, currently used by the mock store

## Service boundaries

### Frontend services

- `src/services/api-client.ts`
  - shared fetch wrapper
  - normalizes `{ data }` envelopes and API errors
- `src/services/study-focus-v1-api.ts`
  - typed client for the v1 route surface
- `src/services/study-focus-api.ts`
  - compatibility transport selector for the legacy frontend shell

### Backend services

- `src/lib/services/profiles.ts`
  - current-profile lifecycle and presence touch
- `src/lib/services/groups.ts`
  - group list/detail/create/join/presence snapshot
- `src/lib/services/study-sessions.ts`
  - session list and lifecycle transitions
- `src/lib/services/leaderboards.ts`
  - group leaderboard assembly
- `src/lib/services/exam-countdowns.ts`
  - exams CRUD
- `src/lib/services/discussion-posts.ts`
  - discussion CRUD
- `src/lib/services/mappers.ts`
  - single mapping layer from Supabase rows/RPC outputs to shared DTOs
- `src/lib/services/study-focus-api-adapter.ts`
  - compatibility-only adapter from backend services to the legacy frontend shell contract

### Data-access rule

Database access should stay inside `src/lib/services/*` or `src/lib/supabase/*`.

Feature components should only use frontend client services.

Route handlers should be thin:

- validate request
- require auth
- call one backend service
- shape response with `ok`, `created`, or `handleRouteError`

## Future extension points

- migrate remaining feature screens from the legacy shell contract to `src/services/study-focus-v1-api.ts`
- add missing v1 surfaces only when the UI needs them:
  - sign-out/session introspection
  - group member management
  - discussion edit/delete UI hooks
  - profile edit UI hooks
- add browser-side Supabase Realtime subscriptions for live group presence beyond heartbeat snapshots
- add deployment CI gates around:
  - `npm run typecheck`
  - `npm run build`
  - smoke flow execution
- retire the compatibility `/api/*` adapter once all screens consume v1 clients

## Structural changes made in this pass

- `src/contracts/index.ts` now exports both shared DTOs and shared route/service contracts.
- `src/contracts/study-focus.ts` now explicitly names the compatibility interface as `LegacyStudyFocusApi`.
- `src/services/study-focus-api.ts` now exposes `getLegacyStudyFocusApi` while preserving `getStudyFocusApi` as a compatibility alias.
- `src/services/study-focus-v1-api.ts` and `src/features/focus/focus-page.tsx` now import shared transport contracts through `@/contracts`, reducing direct package-path drift inside the app.

## Top technical risks

1. The codebase still has two active HTTP surfaces, which increases migration and maintenance cost.
2. `study-focus-shared/src/contracts/models.ts` and `study-focus-shared/src/contracts/api.ts` still use different status vocabularies, so semantic drift is possible.
3. The legacy frontend shell still depends on `src/contracts/study-focus.ts`, which duplicates many UI-facing shapes.
4. Presence behavior is split between profile heartbeat, group snapshot RPCs, and future realtime subscriptions, so it is easy to extend inconsistently.
5. Some features already use v1 while others still use the legacy adapter, which can produce mixed assumptions about data freshness and ownership.
6. The current architecture depends heavily on Supabase RPCs; schema or function drift will directly affect runtime behavior.
7. There is no automated CI gate yet for smoke coverage across auth, groups, focus, exams, and leaderboard flows.
8. The compatibility adapter centralizes useful presentation mapping, but it can become a long-lived second domain layer if migration to v1 stalls.
