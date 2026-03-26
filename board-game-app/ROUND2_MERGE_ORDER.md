# Round 2 Merge Order

## Recommended merge order

1. Confirm or restore the real canonical `board-game-app` repo and its build conventions.
2. Merge Worker B source files first.
3. Merge Worker C source files second.
4. Do not merge Worker A output until that worker actually exists on disk.

## Likely safe merge areas

- Worker B `src/ingestion/**`
- Worker C `src/ai/**` source files

## Likely conflict areas

- Root `src/index.ts`
- `tsconfig` and module/build conventions
- Declaration-output policy and whether generated artifacts should be committed
- Shared runtime config and any confirmed-IR naming that must align across workers

## What should not be merged yet

- Anything from Worker A
- Worker C `dist/**` until the canonical repo confirms generated files should be committed
- Root build/config changes until the real canonical repo is visible
