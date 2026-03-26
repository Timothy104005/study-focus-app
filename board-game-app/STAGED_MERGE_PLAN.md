# Staged Merge Plan

## Merge order

1. Worker B core ingestion foundation
   - Status: already merged into the canonical base.
2. Worker C source routing slice
   - Merge after a focused review of routing defaults, model IDs, and root export changes.
3. Worker B review/compile-gating layer
   - Merge only after confirmed-layer naming and handoff semantics are settled.

## What to check after each merge

- After Worker B core merge
  - Run `npm exec --yes --package typescript -- tsc -p board-game-app/tsconfig.json`
  - Confirm `src/index.ts` exports only the staged core ingestion surface.
  - Confirm no review/compile-gating files are referenced yet.
- After Worker C source merge
  - Run `npm exec --yes --package typescript -- tsc -p board-game-app/tsconfig.json`
  - Confirm `src/index.ts` exports the AI surface intentionally.
  - Review `routing.ts` and `config/default-model-profiles.ts` once more before treating the defaults as accepted.
- After any future Worker B review/compile merge
  - Re-check confirmed-layer naming such as `ALLOWED_CONFIRMED_KINDS` and `confirmedArtifactId`
  - Confirm the review/compile-gating language matches the intended pipeline behavior

## Likely conflict areas

- Root `src/index.ts`
- `tsconfig.json` and any future build/output conventions
- Worker C default model IDs, deployment-policy shape, and task-category defaults
- Worker B confirmed-layer naming and compile-readiness semantics

## Where to stop if risk becomes too high

- Stop before merging Worker C if the routing defaults or model catalog names are still disputed.
- Stop before merging Worker B review/compile files if confirmed-layer semantics are still missing.
- Stop before adding generated output such as `dist/**` unless the canonical repo explicitly wants committed build artifacts.
