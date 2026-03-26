# Round 3 Merge Rehearsal

## Recommended merge order

1. Confirm or restore the real canonical `board-game-app` repo and its root build/export conventions.
2. Safest first merge: Worker B core ingestion foundation only.
3. Second merge: Worker C source routing slice, excluding generated output.
4. Hold Worker A work until that worker actually exists on disk.

## Likely safe merge areas

- Worker B `src/ingestion/contracts.ts`
- Worker B `src/ingestion/validation.ts`
- Worker B `src/ingestion/guards.ts`
- Worker B `src/ingestion/traceability.ts`
- Worker B `src/ingestion/fixtures.ts`
- Worker B `src/index.ts` and README updates
- Worker C `src/ai/**` source files, with `createAiRoutingStack` and `InferenceRouter` treated as the single AI entry boundary

## Likely conflict areas

- Root `src/index.ts`
- `tsconfig`, module format, declaration/build policy, and export-path conventions
- Worker B confirmed-layer naming such as `ALLOWED_CONFIRMED_KINDS` and `confirmedArtifactId`
- Worker C default model IDs, deployment-policy shape, and task-category defaults
- Any runtime composition code that tries to bypass `InferenceRouter`

## What should not be merged yet

- Anything from Worker A
- Worker B `reviewPatch.ts`, `compileReadiness.ts`, and `reviewFixtures.ts` until confirmed-layer semantics are aligned
- Worker C `dist/**` until the canonical repo confirms generated files should be committed

## What dependencies matter most

- Worker B's review/compile-gating layer depends most on Worker A's confirmed-layer vocabulary and handoff semantics.
- Worker C's runtime usefulness depends most on concrete `ProviderAdapter` implementations and canonical runtime configuration.
- Both Worker B and Worker C still depend on the real canonical repo for final root-level alignment.
