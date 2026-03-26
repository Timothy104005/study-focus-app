# Integration Decision

## What is merge-ready now

- Worker B core ingestion foundation is merge-ready now and has already been staged into the canonical base:
  - `src/ingestion/contracts.ts`
  - `src/ingestion/validation.ts`
  - `src/ingestion/traceability.ts`
  - `src/ingestion/fixtures.ts`
  - `src/index.ts`
  - `tsconfig.json`
- This staged merge passed a canonical TypeScript smoke check.
- Worker C source routing slice looks like the next likely merge candidate, but it should still be reviewed before landing.

## What is not merge-ready

- Anything from Worker A, because that worker is still missing.
- Worker B `reviewPatch.ts`, `compileReadiness.ts`, `reviewFixtures.ts`, and the current `guards.ts`, because those still pull in unresolved confirmed-layer or review-flow semantics.
- Worker C `dist/**` and any runtime adapter work, because generated output policy and concrete provider choices are not settled.

## Single recommended next action

- Review Worker C source defaults and routing assumptions, then stage Worker C source files into the canonical base as the second merge, leaving generated output and adapter implementation out for now.
