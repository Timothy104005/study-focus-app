import {
  CandidateEntity,
  CandidateIngestionDraft,
  IssueId,
  TraceId,
  getCandidateEntityId,
} from "./contracts";
import { ReviewAction, ReviewActionId, ReviewPatchBundle, PatchRecordId } from "./reviewPatch";
import { resolveEvidenceRefsForEntity } from "./traceability";

export type ReviewDecisionStatus = "pending" | "confirmed" | "rejected";

/**
 * Small candidate-centric view model for review tooling.
 * This stays in the candidate layer and never embeds confirmed artifacts directly.
 */
export interface ReviewableCandidateState {
  kind: "reviewable_candidate_state";
  candidateId: string;
  candidateKind: CandidateEntity["kind"];
  traceId: TraceId;
  decision: ReviewDecisionStatus;
  latestReviewActionId?: ReviewActionId;
  relatedIssueIds: IssueId[];
  relatedPatchRecordIds: PatchRecordId[];
  evidenceRefCount: number;
  unresolvedEvidenceRefCount: number;
}

export interface ReviewPatchOverview {
  kind: "review_patch_overview";
  totalCandidateCount: number;
  pendingCandidateCount: number;
  confirmedCandidateCount: number;
  rejectedCandidateCount: number;
  unresolvedIssueCount: number;
  patchRecordCount: number;
  reviewActionCount: number;
}

export function buildReviewableCandidateStates(
  draft: CandidateIngestionDraft,
  reviewBundle?: ReviewPatchBundle
): ReviewableCandidateState[] {
  const decisionByCandidateId = buildDecisionByCandidateId(
    reviewBundle?.reviewActions ?? []
  );
  const relatedPatchIdsByCandidateId = buildRelatedPatchIdsByCandidateId(
    reviewBundle
  );

  return [...draft.candidateClauses, ...draft.candidateTerms].map((candidate) => {
    const candidateId = getCandidateEntityId(candidate);
    const latestDecision = decisionByCandidateId.get(candidateId);
    const evidenceLinks = resolveEvidenceRefsForEntity(draft, candidate);
    const relatedIssueIds = collectRelatedIssueIds(draft, candidateId, candidate);
    const state: ReviewableCandidateState = {
      kind: "reviewable_candidate_state",
      candidateId,
      candidateKind: candidate.kind,
      traceId: candidate.traceId,
      decision:
        latestDecision?.actionType === "confirm"
          ? "confirmed"
          : latestDecision?.actionType === "reject"
            ? "rejected"
            : "pending",
      relatedIssueIds,
      relatedPatchRecordIds: relatedPatchIdsByCandidateId.get(candidateId) ?? [],
      evidenceRefCount: candidate.evidenceRefs.length,
      unresolvedEvidenceRefCount: evidenceLinks.filter((item) => !item.isResolved)
        .length,
    };

    if (latestDecision !== undefined) {
      state.latestReviewActionId = latestDecision.reviewActionId;
    }

    return state;
  });
}

export function buildReviewPatchOverview(
  draft: CandidateIngestionDraft,
  reviewBundle?: ReviewPatchBundle
): ReviewPatchOverview {
  const states = buildReviewableCandidateStates(draft, reviewBundle);
  const issueTracking = reviewBundle?.issueTracking ?? [];

  return {
    kind: "review_patch_overview",
    totalCandidateCount: states.length,
    pendingCandidateCount: states.filter((state) => state.decision === "pending")
      .length,
    confirmedCandidateCount: states.filter(
      (state) => state.decision === "confirmed"
    ).length,
    rejectedCandidateCount: states.filter(
      (state) => state.decision === "rejected"
    ).length,
    unresolvedIssueCount: issueTracking.filter(
      (entry) => entry.status !== "resolved"
    ).length,
    patchRecordCount: reviewBundle?.patchRecords.length ?? 0,
    reviewActionCount: reviewBundle?.reviewActions.length ?? 0,
  };
}

function buildDecisionByCandidateId(
  reviewActions: ReviewAction[]
): Map<string, ReviewAction> {
  const decisionByCandidateId = new Map<string, ReviewAction>();

  reviewActions.forEach((action) => {
    if (action.actionType === "confirm" || action.actionType === "reject") {
      decisionByCandidateId.set(action.target.id, action);
    }
  });

  return decisionByCandidateId;
}

function buildRelatedPatchIdsByCandidateId(
  reviewBundle?: ReviewPatchBundle
): Map<string, PatchRecordId[]> {
  const patchIdsByCandidateId = new Map<string, Set<PatchRecordId>>();

  reviewBundle?.patchRecords.forEach((patchRecord) => {
    if (patchRecord.target.kind === "issue") {
      return;
    }

    const current = patchIdsByCandidateId.get(patchRecord.target.id) ?? new Set();
    current.add(patchRecord.patchRecordId);
    patchIdsByCandidateId.set(patchRecord.target.id, current);
  });

  reviewBundle?.reviewActions.forEach((action) => {
    if (
      action.target.kind === "issue" ||
      action.relatedPatchRecordIds === undefined
    ) {
      return;
    }

    const current = patchIdsByCandidateId.get(action.target.id) ?? new Set();
    action.relatedPatchRecordIds.forEach((patchRecordId) => current.add(patchRecordId));
    patchIdsByCandidateId.set(action.target.id, current);
  });

  return new Map(
    [...patchIdsByCandidateId.entries()].map(([candidateId, patchIds]) => [
      candidateId,
      [...patchIds],
    ])
  );
}

function collectRelatedIssueIds(
  draft: CandidateIngestionDraft,
  candidateId: string,
  candidate: CandidateEntity
): IssueId[] {
  const relatedIssueIds = new Set<IssueId>(candidate.linkedIssueIds ?? []);

  draft.issues.forEach((issue) => {
    if (issue.subjectRefs.some((subjectRef) => subjectRef.id === candidateId)) {
      relatedIssueIds.add(issue.issueId);
    }
  });

  return [...relatedIssueIds];
}
