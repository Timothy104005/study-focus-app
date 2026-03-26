# Merge Ready B

## Likely safe to merge now

- Core ingestion contracts in `src/ingestion/contracts.ts`.
- Structural validation helpers in `src/ingestion/validation.ts`.
- Guard helpers in `src/ingestion/guards.ts`.
- Traceability helpers in `src/ingestion/traceability.ts`.
- Minimal sample fixture bundle in `src/ingestion/fixtures.ts`.
- Barrel exports in `src/index.ts` and the README updates.

## What still needs review before merge

- Confirm the confirmed-layer allowlist names in `ALLOWED_CONFIRMED_KINDS` match Worker A's eventual confirmed IR vocabulary.
- Confirm `EvidenceKind` is broad enough for the expected rulebook sources and errata/FAQ inputs.
- Confirm string ID aliases are acceptable for now versus introducing branded IDs later.
- Review whether the example fixture names and sample rule text are aligned with the team's preferred fixture naming conventions.

## Likely overlap or conflict risk with Worker A or C

- Worker A may touch confirmed IR naming and any future promotion seam, so `ConfirmedIRBoundaryPlaceholder` constants are the most likely shared surface.
- Worker C may touch review/extraction integration points, so `validation.ts`, `traceability.ts`, and `fixtures.ts` are the most likely overlap areas.
- If another worker adds root package tooling or a broader repo structure, the local package surface may need a small export-path adjustment.

## Future integration point now enabled

- Upstream extraction code can now emit a `CandidateIngestionDraft`, run `validateCandidateIngestionDraft`, and use `buildDraftTraceabilityRecords` to drive review/debug flows without treating candidates as confirmed IR.
