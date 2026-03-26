## [0.2.0] - 2026-03-27
### Changed
- Auth: replaced magic link with email+password login
- Focus page: redesigned with Vanilla Custard / Misty Sage / Bloodstone palette
- Global CSS: added color custom properties

### Fixed
- Build errors resolved

### Added
- Vercel deployment (record URL here): Deployment blocked in this environment (npm registry 403 for Vercel CLI)
- Demo account seeded: script added at `scripts/seed-demo.ts` (seeding blocked in this environment due missing Supabase env + npm registry 403 for ts-node)
