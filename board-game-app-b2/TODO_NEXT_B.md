# TODO Next B

## Highest-value next tasks within Worker B scope

- Add focused unit tests for `validateCandidateIngestionDraft` and `validateReviewPatchBundle`, especially dangling targets, boundary mismatches, and missing patch refs.
- Add focused unit tests for `buildCompileReadinessSnapshot`, especially transitions between unresolved issues, pending review decisions, rejected candidates, and ready-to-compile states.
- Add focused unit tests for `buildDraftTraceabilityRecords`, `buildIssueTrackingEntries`, and the guard helpers so integrators can trust the helper surface.
- Decide whether term normalization should stay as `normalizedKey` only or also expose a shared slug helper once real ingestion samples exist.
- Decide whether evidence metadata needs a lightweight `sourceType` or `documentKind` above `EvidenceKind` once more than one rules document format is present.
- Add optional schema version metadata if another worker starts serializing drafts across package boundaries.

## Dependencies on Worker A or Worker C

- Worker A: align on the eventual confirmed IR artifact names so the boundary placeholder constants match the confirmed package vocabulary.
- Worker A: align on what `confirmedArtifactId` should look like and whether compile gating should require at least one confirmed clause, one confirmed term, or a stronger confirmed bundle definition.
- Worker A: confirm whether any downstream review system expects branded IDs or plain string IDs.
- Worker C: if they build extraction or review tooling, they should wire into `validateCandidateIngestionDraft`, `validateReviewPatchBundle`, and `buildDraftTraceabilityRecords` rather than treating structural errors as gameplay `Issue` records.
- Worker C: confirm whether UI/review flows need additional evidence metadata beyond `evidenceKind`, locator fields, excerpt text, trace IDs, and compile-readiness blocker reasons.

## What should be reviewed first tomorrow

- Review `src/ingestion/contracts.ts` first because it defines the long-lived schema surface.
- Review `src/ingestion/reviewPatch.ts` second because it defines the new Review & Fix ledger surface.
- Review `src/ingestion/compileReadiness.ts` third because it now defines the compile-gating contract that other workers are likely to consume next.
