# Round 3 Handoff B

## What is safe to review or merge now

- The candidate-layer schema surface in `src/ingestion/contracts.ts`.
- The review/patch ledger contracts in `src/ingestion/reviewPatch.ts`.
- The compile-gating snapshot model in `src/ingestion/compileReadiness.ts`.
- The helper layers in `src/ingestion/validation.ts`, `src/ingestion/traceability.ts`, and `src/ingestion/guards.ts`.
- The developer fixtures in `src/ingestion/fixtures.ts` and `src/ingestion/reviewFixtures.ts`.

## What still needs validation

- Unit tests for review/patch bundle validation and compile-readiness transitions.
- Confirmation that `confirmedArtifactId` and `ALLOWED_CONFIRMED_KINDS` line up with Worker A's confirmed-layer vocabulary.
- Confirmation that the current `CompileReadinessStatus` values match the review UI or pipeline gating language Worker C expects.
- Confirmation that the sample review flow covers the team's preferred patch/edit semantics without needing a richer patch grammar.

## What future integration point is now enabled

- Upstream review tooling can now load a `CandidateIngestionDraft`.
- Upstream review tooling can now record `ReviewAction` and `PatchRecord` entries.
- Upstream review tooling can now track unresolved issues through `IssueTrackingEntry`.
- Upstream review tooling can now compute `CompileReadinessSnapshot`.
- Upstream review tooling can now hand confirmed references across the boundary without constructing confirmed artifacts inside Worker B scope.

## Likely overlap or conflict risk with Worker A or C

- Worker A is the most likely overlap on `confirmedArtifactId`, `ALLOWED_CONFIRMED_KINDS`, and any interpretation of what "ready for confirmed compile" should require.
- Worker C is the most likely overlap on `CompileReadinessSnapshot`, guard/helper consumption, and the fixture-driven review flow semantics.
- If another worker introduces a shared root package layout or cross-package typing strategy, the current local barrel exports may need a small alignment pass.
