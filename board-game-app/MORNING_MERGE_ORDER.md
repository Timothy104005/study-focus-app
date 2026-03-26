# Morning Merge Order

## Recommended merge order

1. Confirm or restore the real canonical `board-game-app` repo and its root conventions.
2. Merge Worker B core ingestion foundation first.
3. Merge Worker C source routing slice second.
4. Keep Worker A paused until it actually appears on disk.

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
- `tsconfig`, module format, build output policy, and export-path conventions
- Worker B confirmed-layer naming such as `ALLOWED_CONFIRMED_KINDS` and `confirmedArtifactId`
- Worker C default model IDs, deployment-policy shape, and task-category defaults

## What should not be merged yet

- Anything from Worker A
- Worker B `reviewPatch.ts`, `compileReadiness.ts`, and `reviewFixtures.ts` until confirmed-layer semantics are aligned
- Worker C `dist/**` until the canonical repo confirms generated files should be committed

## Which worker output needs the most review first

- Worker B needs the first detailed review because its contract surface will shape downstream integration and later confirmed-layer work.
