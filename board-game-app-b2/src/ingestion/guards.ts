import {
  CandidateClause,
  CandidateEntity,
  CandidateTerm,
  ConfirmedIRBoundaryPlaceholder,
  EvidenceBackedEntity,
  EvidenceBlock,
  Issue,
} from "./contracts";
import { CompileReadinessSnapshot } from "./compileReadiness";
import { PatchEntry, PatchRecord, ReviewAction, ReviewPatchBundle } from "./reviewPatch";
import { ReviewPatchOverview, ReviewableCandidateState } from "./reviewSummary";

type KindedValue = { kind?: string };

function hasKind(value: unknown, expectedKind: string): value is KindedValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    (value as KindedValue).kind === expectedKind
  );
}

export function isEvidenceBlock(value: unknown): value is EvidenceBlock {
  return hasKind(value, "evidence_block");
}

export function isCandidateClause(value: unknown): value is CandidateClause {
  return hasKind(value, "candidate_clause");
}

export function isCandidateTerm(value: unknown): value is CandidateTerm {
  return hasKind(value, "candidate_term");
}

export function isCandidateEntity(value: unknown): value is CandidateEntity {
  return isCandidateClause(value) || isCandidateTerm(value);
}

export function isIssue(value: unknown): value is Issue {
  return hasKind(value, "issue");
}

export function isEvidenceBackedEntity(
  value: unknown
): value is EvidenceBackedEntity {
  return isCandidateEntity(value) || isIssue(value);
}

export function isConfirmedIRBoundaryPlaceholder(
  value: unknown
): value is ConfirmedIRBoundaryPlaceholder {
  return hasKind(value, "confirmed_ir_boundary_placeholder");
}

export function isPatchEntry(value: unknown): value is PatchEntry {
  return hasKind(value, "patch_entry");
}

export function isPatchRecord(value: unknown): value is PatchRecord {
  return hasKind(value, "patch_record");
}

export function isReviewAction(value: unknown): value is ReviewAction {
  return hasKind(value, "review_action");
}

export function isReviewPatchBundle(value: unknown): value is ReviewPatchBundle {
  return hasKind(value, "review_patch_bundle");
}

export function isCompileReadinessSnapshot(
  value: unknown
): value is CompileReadinessSnapshot {
  return hasKind(value, "compile_readiness_snapshot");
}

export function isReviewableCandidateState(
  value: unknown
): value is ReviewableCandidateState {
  return hasKind(value, "reviewable_candidate_state");
}

export function isReviewPatchOverview(
  value: unknown
): value is ReviewPatchOverview {
  return hasKind(value, "review_patch_overview");
}
