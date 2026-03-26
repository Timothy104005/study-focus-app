# Rulebook ingestion foundation

This package defines developer-facing contracts for the rulebook ingestion layer.

## Included concepts

- `EvidenceBlock` stores source-backed rulebook excerpts and their location.
- `CandidateClause` stores extracted clause candidates with evidence references.
- `CandidateTerm` stores extracted terminology candidates with evidence references.
- `Issue` stores ambiguity or contradiction findings tied back to candidates and evidence.
- `ConfirmedIRBoundaryPlaceholder` marks the handoff into a future confirmed IR package.
- `CandidateIngestionDraft` groups ingestion outputs while keeping them explicitly unconfirmed.
- Validation helpers catch broken evidence links and dangling candidate references.
- Guard helpers make the model safer to consume from untyped integration points.
- Sample fixtures provide a minimal end-to-end draft with explicit traceability.
- Review/patch contracts provide confirm, reject, edit, patch, and issue-tracking records.
- Compile-readiness snapshots separate candidate completeness, unresolved issues, confirmed status, and final gating.

## Design intent

- Candidate artifacts stay separate from confirmed IR artifacts.
- Every candidate and issue keeps a `traceId` plus `evidenceRefs`.
- Evidence is centralized in `EvidenceBlock` records for later review and patch workflows.
- Structural validation is kept separate from gameplay ambiguity/contradiction issues.

## Review And Fix

- `ReviewPatchBundle` records review actions and patch records without creating confirmed artifacts.
- `buildIssueTrackingEntries()` provides a small unresolved/resolved view over issue handling.
- `buildCompileReadinessSnapshot()` exposes a compile-gating summary that stays separate from candidate and confirmed structures.
- `createSampleReviewFlowBundle()` demonstrates a plausible review/edit/resolve/confirm/reject flow.
- `buildReviewableCandidateStates()` and `buildReviewPatchOverview()` provide small review-friendly state summaries without introducing UI-specific code.

## Integration helpers

- `createSampleDraftBundle()` returns a valid sample draft plus traceability and validation outputs.
- `buildDraftTraceabilityRecords()` resolves each candidate or issue back to source evidence blocks.
- `validateCandidateIngestionDraft()` checks structural integrity without turning those findings into gameplay issues.
