# Study Focus TW MVP Scope

## MVP features

- Supabase auth with lightweight student profiles and class-group membership.
- Study session tracking with start, stop, manual logging, and realistic web focus signals such as tab hidden, window blur, and manual pauses.
- Group leaderboards to compare total study time by day, week, and month.
- Class groups with invite codes, member lists, and simple presence states such as online, studying, and on break.
- Personal and group exam countdowns for upcoming quizzes, mocks, and major exams.
- Short group discussion posts for quick study updates, reminders, and encouragement.
- Shared mock seed data so frontend and backend can develop locally before the full Supabase schema is wired.

## Deferred features

- Native mobile apps and true device-wide focus enforcement.
- Blocking other phone apps, system settings, or notifications.
- Push notifications, background audio, pomodoro variations, and richer habit systems.
- Attachments, reactions, moderation tools, and long-form discussion threads.
- School verification, anti-cheat ranking rules, advanced analytics, and parent or teacher dashboards.

## Web limitations of "device lock"

- A web app cannot reliably block other apps or lock a student's phone or computer.
- For the MVP, the app should only detect browser-level interruptions while the study page is open, including tab visibility changes, window blur, missed heartbeats, and manual pauses.
- Background tabs can be throttled by browsers, so session quality should be inferred from heartbeats and interruption signals instead of pretending the web can enforce continuous device focus.

## Parallel build notes

- TODO(frontend): build the Next.js App Router screens against `study-focus-shared/src/mock/seed.ts` first, then swap to Supabase-backed service adapters.
- TODO(backend): translate the shared models into Supabase tables, RLS policies, and Next.js route handlers or server actions without changing the contract surface.
