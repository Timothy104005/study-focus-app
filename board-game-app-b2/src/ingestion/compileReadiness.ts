import { CandidateIngestionDraft, IssueId } from "./contracts";
import {
  ReviewAction,
  ReviewPatchBundle,
  buildIssueTrackingEntries,
  validateReviewPatchBundle,
} from "./reviewPatch";
import { validateCandidateIngestionDraft } from "./validation";

export type CandidateCompletenessStatus = "incomplete" | "complete";

export interface CandidateCompletenessSummary {
  status: CandidateCompletenessStatus;
  totalCandidateCount: number;
  missingEvidenceCount: number;
  candidateValidationErrorCount: number;
  structuralWarningCount: number;
}

export type UnresolvedIssueStatus =
  | "no_unresolved_issues"
  | "has_unresolved_issues"
  | "has_blocking_unresolved_issues";

export interface UnresolvedIssueSummary {
  status: UnresolvedIssueStatus;
  totalUnresolvedIssueCount: number;
  ambiguityCount: number;
  contradictionCount: number;
  blockingIssueCount: number;
  unresolvedIssueIds: IssueId[];
}

export type ConfirmedStatus =
  | "none_confirmed"
  | "partially_confirmed"
  | "all_remaining_confirmed";

export interface ConfirmedStatusSummary {
  status: ConfirmedStatus;
  totalCandidateCount: number;
  confirmedCandidateCount: number;
  rejectedCandidateCount: number;
  pendingCandidateCount: number;
  reviewedCandidateCount: number;
}

export type CompileReadinessStatus =
  | "blocked_by_candidate_gaps"
  | "blocked_by_review_contract_errors"
  | "blocked_by_unresolved_issues"
  | "awaiting_review_resolution"
  | "no_confirmed_candidates"
  | "ready_for_confirmed_compile";

export interface CompileReadinessSummary {
  status: CompileReadinessStatus;
  isReady: boolean;
  blockerReasons: string[];
  reviewValidationErrorCount: number;
}

/**
 * Read-only view model for gating candidate drafts before confirmed compilation.
 * It keeps completeness, unresolved issues, confirmation state, and final readiness distinct.
 */
export interface CompileReadinessSnapshot {
  kind: "compile_readiness_snapshot";
  draftId: CandidateIngestionDraft["draftId"];
  traceId: string;
  reviewPatchBundleId?: ReviewPatchBundle["reviewPatchBundleId"];
  candidateCompleteness: CandidateCompletenessSummary;
  unresolvedIssues: UnresolvedIssueSummary;
  confirmedStatus: ConfirmedStatusSummary;
  compileReadiness: CompileReadinessSummary;
}

/**
 * Builds a minimal compile-gating snapshot from the candidate draft and optional review ledger.
 */
export function buildCompileReadinessSnapshot(
  draft: CandidateIngestionDraft,
  reviewBundle?: ReviewPatchBundle
): CompileReadinessSnapshot {
  const candidateValidationFindings = validateCandidateIngestionDraft(draft);
  const reviewValidationFindings =
    reviewBundle === undefined
      ? []
      : validateReviewPatchBundle(draft, reviewBundle);

  const totalCandidateCount =
    draft.candidateClauses.length + draft.candidateTerms.length;

  const missingEvidenceCount = candidateValidationFindings.filter(
    (finding) =>
      finding.code === "missing_evidence" &&
      (finding.entityKind === "candidate_clause" ||
        finding.entityKind === "candidate_term")
  ).length;

  const candidateValidationErrorCount = candidateValidationFindings.filter(
    (finding) => finding.severity === "error"
  ).length;

  const structuralWarningCount = candidateValidationFindings.filter(
    (finding) => finding.severity === "warning"
  ).length;

  const candidateCompleteness: CandidateCompletenessSummary = {
    status:
      totalCandidateCount > 0 &&
      missingEvidenceCount === 0 &&
      candidateValidationErrorCount === 0
        ? "complete"
        : "incomplete",
    totalCandidateCount,
    missingEvidenceCount,
    candidateValidationErrorCount,
    structuralWarningCount,
  };

  const issueTracking =
    reviewBundle?.issueTracking ?? buildIssueTrackingEntries(draft, []);
  const unresolvedIssues = issueTracking.filter(
    (entry) => entry.status !== "resolved"
  );
  const unresolvedIssueIds = unresolvedIssues.map((entry) => entry.issueId);
  const unresolvedIssueRecords = draft.issues.filter((issue) =>
    unresolvedIssueIds.includes(issue.issueId)
  );

  const unresolvedIssueSummary: UnresolvedIssueSummary = {
    status:
      unresolvedIssueRecords.length === 0
        ? "no_unresolved_issues"
        : unresolvedIssueRecords.some((issue) => issue.severity === "blocking")
          ? "has_blocking_unresolved_issues"
          : "has_unresolved_issues",
    totalUnresolvedIssueCount: unresolvedIssueRecords.length,
    ambiguityCount: unresolvedIssueRecords.filter(
      (issue) => issue.issueKind === "ambiguity"
    ).length,
    contradictionCount: unresolvedIssueRecords.filter(
      (issue) => issue.issueKind === "contradiction"
    ).length,
    blockingIssueCount: unresolvedIssueRecords.filter(
      (issue) => issue.severity === "blocking"
    ).length,
    unresolvedIssueIds,
  };

  const decisionByTargetId = buildDecisionByTargetId(reviewBundle?.reviewActions ?? []);
  const reviewedCandidateCount = decisionByTargetId.size;
  const confirmedCandidateCount = [...decisionByTargetId.values()].filter(
    (action) => action.actionType === "confirm"
  ).length;
  const rejectedCandidateCount = [...decisionByTargetId.values()].filter(
    (action) => action.actionType === "reject"
  ).length;
  const pendingCandidateCount = Math.max(
    totalCandidateCount - reviewedCandidateCount,
    0
  );

  const confirmedStatus: ConfirmedStatusSummary = {
    status:
      confirmedCandidateCount === 0
        ? "none_confirmed"
        : pendingCandidateCount === 0
          ? "all_remaining_confirmed"
          : "partially_confirmed",
    totalCandidateCount,
    confirmedCandidateCount,
    rejectedCandidateCount,
    pendingCandidateCount,
    reviewedCandidateCount,
  };

  const reviewValidationErrorCount = reviewValidationFindings.filter(
    (finding) => finding.severity === "error"
  ).length;

  const compileReadiness = buildCompileReadinessSummary(
    candidateCompleteness,
    unresolvedIssueSummary,
    confirmedStatus,
    reviewValidationErrorCount
  );

  const snapshot: CompileReadinessSnapshot = {
    kind: "compile_readiness_snapshot",
    draftId: draft.draftId,
    traceId: reviewBundle?.traceId ?? draft.traceId,
    candidateCompleteness,
    unresolvedIssues: unresolvedIssueSummary,
    confirmedStatus,
    compileReadiness,
  };

  if (reviewBundle !== undefined) {
    snapshot.reviewPatchBundleId = reviewBundle.reviewPatchBundleId;
  }

  return snapshot;
}

function buildDecisionByTargetId(
  reviewActions: ReviewAction[]
): Map<string, ReviewAction> {
  const decisionByTargetId = new Map<string, ReviewAction>();

  reviewActions.forEach((action) => {
    if (action.actionType === "confirm" || action.actionType === "reject") {
      decisionByTargetId.set(action.target.id, action);
    }
  });

  return decisionByTargetId;
}

function buildCompileReadinessSummary(
  candidateCompleteness: CandidateCompletenessSummary,
  unresolvedIssues: UnresolvedIssueSummary,
  confirmedStatus: ConfirmedStatusSummary,
  reviewValidationErrorCount: number
): CompileReadinessSummary {
  const blockerReasons: string[] = [];

  if (candidateCompleteness.status === "incomplete") {
    blockerReasons.push("Candidate layer is not structurally complete.");
  }

  if (reviewValidationErrorCount > 0) {
    blockerReasons.push("Review/patch bundle has contract errors.");
  }

  if (unresolvedIssues.totalUnresolvedIssueCount > 0) {
    blockerReasons.push("One or more ambiguity/contradiction issues remain unresolved.");
  }

  if (confirmedStatus.pendingCandidateCount > 0) {
    blockerReasons.push("Some candidate artifacts still have no terminal review decision.");
  }

  if (confirmedStatus.confirmedCandidateCount === 0) {
    blockerReasons.push("No candidate artifacts have been confirmed for handoff.");
  }

  if (candidateCompleteness.status === "incomplete") {
    return {
      status: "blocked_by_candidate_gaps",
      isReady: false,
      blockerReasons,
      reviewValidationErrorCount,
    };
  }

  if (reviewValidationErrorCount > 0) {
    return {
      status: "blocked_by_review_contract_errors",
      isReady: false,
      blockerReasons,
      reviewValidationErrorCount,
    };
  }

  if (unresolvedIssues.totalUnresolvedIssueCount > 0) {
    return {
      status: "blocked_by_unresolved_issues",
      isReady: false,
      blockerReasons,
      reviewValidationErrorCount,
    };
  }

  if (confirmedStatus.pendingCandidateCount > 0) {
    return {
      status: "awaiting_review_resolution",
      isReady: false,
      blockerReasons,
      reviewValidationErrorCount,
    };
  }

  if (confirmedStatus.confirmedCandidateCount === 0) {
    return {
      status: "no_confirmed_candidates",
      isReady: false,
      blockerReasons,
      reviewValidationErrorCount,
    };
  }

  return {
    status: "ready_for_confirmed_compile",
    isReady: true,
    blockerReasons: [],
    reviewValidationErrorCount,
  };
}
