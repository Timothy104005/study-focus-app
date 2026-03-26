import {
  CandidateIngestionDraft,
  CandidateTerm,
  CreateCandidateIngestionDraftInput,
  EvidenceBlock,
  Issue,
  createCandidateEntityRef,
  createCandidateIngestionDraft,
  createEvidenceRef,
} from "./contracts";
import {
  CompileReadinessSnapshot,
  buildCompileReadinessSnapshot,
} from "./compileReadiness";
import { createSampleDraftBundle } from "./fixtures";
import {
  AddPatchAction,
  ConfirmCandidateAction,
  EditCandidateAction,
  MarkIssueUnresolvedAction,
  PatchRecord,
  RejectCandidateAction,
  ResolveIssueAction,
  ReviewPatchBundle,
  ReviewPatchValidationFinding,
  createIssueRef,
  createPatchEntry,
  createPatchRecord,
  createReviewPatchBundle,
  validateReviewPatchBundle,
} from "./reviewPatch";
import {
  ReviewPatchOverview,
  ReviewableCandidateState,
  buildReviewPatchOverview,
  buildReviewableCandidateStates,
} from "./reviewSummary";

export interface SampleReviewFlowBundle {
  draft: CandidateIngestionDraft;
  reviewPatchBundle: ReviewPatchBundle;
  reviewValidationFindings: ReviewPatchValidationFinding[];
  reviewableCandidateStates: ReviewableCandidateState[];
  reviewPatchOverview: ReviewPatchOverview;
  preReviewCompileReadiness: CompileReadinessSnapshot;
  postReviewCompileReadiness: CompileReadinessSnapshot;
}

/**
 * Example Review & Fix flow that exercises patching, issue tracking, confirm/reject actions,
 * and compile readiness without constructing any confirmed artifacts in-process.
 */
export function createSampleReviewFlowBundle(): SampleReviewFlowBundle {
  const base = createSampleDraftBundle();
  const setupEvidence = requireEvidenceBlock(base, "ev-setup-1");
  const handLimitEvidence = requireEvidenceBlock(base, "ev-limit-1");
  const setupDrawClause = requireClause(base, "clause-setup-draw-5");
  const drawAtTurnStartClause = requireClause(base, "clause-draw-1-at-turn-start");
  const drawBlockedAtLimitClause = requireClause(
    base,
    "clause-draw-blocked-at-limit"
  );
  const startingHandTerm = requireTerm(base, "term-starting-hand");
  const handLimitTerm = requireTerm(base, "term-hand-limit");
  const drawIssue = requireIssue(base, "issue-draw-obligation-vs-restriction");

  const duplicateOpeningHandTerm: CandidateTerm = {
    kind: "candidate_term",
    candidateTermId: "term-opening-hand-alias",
    traceId: "trace-term-opening-hand-alias",
    parentTraceIds: [setupEvidence.traceId],
    termCategory: "resource",
    canonicalName: "opening hand",
    normalizedKey: "opening_hand",
    surfaceForms: ["opening hand"],
    candidateDefinition: "Alternate phrasing for the setup hand term.",
    evidenceRefs: [createEvidenceRef(setupEvidence, "supporting")],
    reviewState: "pending_review",
  };

  const draftInput: CreateCandidateIngestionDraftInput = {
    draftId: `${base.draft.draftId}-review`,
    traceId: "trace-draft-sample-rulebook-r1-review",
    sourceDocumentId: base.draft.sourceDocumentId,
    evidenceBlocks: base.evidenceBlocks,
    candidateClauses: base.candidateClauses,
    candidateTerms: [...base.candidateTerms, duplicateOpeningHandTerm],
    issues: base.issues,
  };

  if (base.draft.sourceRevisionId !== undefined) {
    draftInput.sourceRevisionId = base.draft.sourceRevisionId;
  }

  const draft = createCandidateIngestionDraft(draftInput);

  const patchRecord: PatchRecord = createPatchRecord({
    patchRecordId: "patch-draw-exception-clarification",
    traceId: "trace-patch-draw-exception-clarification",
    target: createCandidateEntityRef(drawBlockedAtLimitClause),
    entries: [
      createPatchEntry({
        patchEntryId: "patch-entry-draw-statement",
        traceId: "trace-patch-entry-draw-statement",
        target: createCandidateEntityRef(drawBlockedAtLimitClause),
        fieldPath: "statement",
        op: "replace",
        previousValue: drawBlockedAtLimitClause.statement,
        nextValue:
          "If a player already has 7 cards in hand, the normal turn-start draw does not occur.",
        evidenceRefs: [
          createEvidenceRef(handLimitEvidence, "primary"),
          createEvidenceRef(
            setupEvidence,
            "supporting",
            "Included as contrast with the setup draw rule."
          ),
        ],
        rationale:
          "Clarifies that the hand-limit sentence behaves as an exception to the draw rule rather than a standalone contradiction.",
      }),
      createPatchEntry({
        patchEntryId: "patch-entry-draw-condition",
        traceId: "trace-patch-entry-draw-condition",
        target: createCandidateEntityRef(drawBlockedAtLimitClause),
        fieldPath: "conditionText",
        op: "replace",
        previousValue: drawBlockedAtLimitClause.conditionText ?? null,
        nextValue: "start of turn when hand size is already 7 cards",
        evidenceRefs: [createEvidenceRef(handLimitEvidence, "primary")],
        rationale: "Normalizes the clause condition for later confirmed handoff.",
      }),
    ],
    status: "applied_to_candidate",
    evidenceRefs: [
      createEvidenceRef(handLimitEvidence, "primary"),
      createEvidenceRef(setupEvidence, "supporting"),
    ],
    note: "Patch clarifies the turn-start draw exception and supports issue resolution.",
  });

  const boundaryId = draft.confirmedIRBoundary.confirmedIRBoundaryId;

  const reviewActions = [
    {
      kind: "review_action",
      reviewActionId: "action-add-draw-exception-patch",
      traceId: "trace-action-add-draw-exception-patch",
      actionType: "add_patch",
      target: createCandidateEntityRef(drawBlockedAtLimitClause),
      patchRecordId: patchRecord.patchRecordId,
      patchSummary: "Propose a clarification patch for the hand-limit exception.",
      evidenceRefs: patchRecord.evidenceRefs,
      rationale: "Patch is needed before the conflicting candidates can be resolved cleanly.",
      relatedPatchRecordIds: [patchRecord.patchRecordId],
    } satisfies AddPatchAction,
    {
      kind: "review_action",
      reviewActionId: "action-edit-draw-exception-clause",
      traceId: "trace-action-edit-draw-exception-clause",
      actionType: "edit",
      target: createCandidateEntityRef(drawBlockedAtLimitClause),
      patchRecordId: patchRecord.patchRecordId,
      editSummary: "Apply the clarification patch to the candidate clause.",
      evidenceRefs: patchRecord.evidenceRefs,
      rationale: "Candidate wording is updated to reflect the reviewed exception interpretation.",
      relatedPatchRecordIds: [patchRecord.patchRecordId],
    } satisfies EditCandidateAction,
    {
      kind: "review_action",
      reviewActionId: "action-issue-stays-open-during-edit",
      traceId: "trace-action-issue-stays-open-during-edit",
      actionType: "mark_issue_unresolved",
      target: createIssueRef(drawIssue),
      evidenceRefs: [createEvidenceRef(handLimitEvidence, "primary")],
      rationale: "Issue remains open until the patch is applied and reviewed.",
      unresolvedReason: "Candidate exception wording still needs confirmation after the edit.",
      relatedPatchRecordIds: [patchRecord.patchRecordId],
    } satisfies MarkIssueUnresolvedAction,
    {
      kind: "review_action",
      reviewActionId: "action-resolve-draw-issue",
      traceId: "trace-action-resolve-draw-issue",
      actionType: "resolve_issue",
      target: createIssueRef(drawIssue),
      evidenceRefs: patchRecord.evidenceRefs,
      rationale: "The patch resolves the ambiguity between the mandatory draw rule and the hand-limit exception.",
      resolutionSummary:
        "Treat the hand-limit sentence as an explicit exception to the normal draw-phase obligation.",
      relatedPatchRecordIds: [patchRecord.patchRecordId],
    } satisfies ResolveIssueAction,
    {
      kind: "review_action",
      reviewActionId: "action-confirm-setup-draw-clause",
      traceId: "trace-action-confirm-setup-draw-clause",
      actionType: "confirm",
      target: createCandidateEntityRef(setupDrawClause),
      evidenceRefs: setupDrawClause.evidenceRefs,
      rationale: "Setup draw clause is clear and supported by direct evidence.",
      confirmedBoundaryId: boundaryId,
      confirmedKind: "confirmed_clause",
      confirmedArtifactId: "confirmed-clause:setup-draw-5",
    } satisfies ConfirmCandidateAction,
    {
      kind: "review_action",
      reviewActionId: "action-confirm-turn-draw-clause",
      traceId: "trace-action-confirm-turn-draw-clause",
      actionType: "confirm",
      target: createCandidateEntityRef(drawAtTurnStartClause),
      evidenceRefs: drawAtTurnStartClause.evidenceRefs,
      rationale: "Turn-start draw clause is retained as the base rule.",
      confirmedBoundaryId: boundaryId,
      confirmedKind: "confirmed_clause",
      confirmedArtifactId: "confirmed-clause:draw-at-turn-start",
    } satisfies ConfirmCandidateAction,
    {
      kind: "review_action",
      reviewActionId: "action-confirm-hand-limit-exception-clause",
      traceId: "trace-action-confirm-hand-limit-exception-clause",
      actionType: "confirm",
      target: createCandidateEntityRef(drawBlockedAtLimitClause),
      evidenceRefs: drawBlockedAtLimitClause.evidenceRefs,
      rationale: "Edited clause is confirmed as the reviewed exception rule.",
      confirmedBoundaryId: boundaryId,
      confirmedKind: "confirmed_clause",
      confirmedArtifactId: "confirmed-clause:draw-blocked-at-limit",
      relatedPatchRecordIds: [patchRecord.patchRecordId],
    } satisfies ConfirmCandidateAction,
    {
      kind: "review_action",
      reviewActionId: "action-confirm-starting-hand-term",
      traceId: "trace-action-confirm-starting-hand-term",
      actionType: "confirm",
      target: createCandidateEntityRef(startingHandTerm),
      evidenceRefs: startingHandTerm.evidenceRefs,
      rationale: "Starting hand is a stable gameplay term worth carrying into confirmed IR.",
      confirmedBoundaryId: boundaryId,
      confirmedKind: "confirmed_term",
      confirmedArtifactId: "confirmed-term:starting-hand",
    } satisfies ConfirmCandidateAction,
    {
      kind: "review_action",
      reviewActionId: "action-confirm-hand-limit-term",
      traceId: "trace-action-confirm-hand-limit-term",
      actionType: "confirm",
      target: createCandidateEntityRef(handLimitTerm),
      evidenceRefs: handLimitTerm.evidenceRefs,
      rationale: "Hand limit state is needed by the reviewed exception clause.",
      confirmedBoundaryId: boundaryId,
      confirmedKind: "confirmed_term",
      confirmedArtifactId: "confirmed-term:hand-limit",
    } satisfies ConfirmCandidateAction,
    {
      kind: "review_action",
      reviewActionId: "action-reject-opening-hand-alias",
      traceId: "trace-action-reject-opening-hand-alias",
      actionType: "reject",
      target: createCandidateEntityRef(duplicateOpeningHandTerm),
      evidenceRefs: duplicateOpeningHandTerm.evidenceRefs,
      rationale: "Alias term is redundant once 'starting hand' is confirmed as the canonical concept.",
      rejectionReason: "Duplicate terminology candidate.",
    } satisfies RejectCandidateAction,
  ];

  const reviewPatchBundle = createReviewPatchBundle({
    reviewPatchBundleId: "review-bundle-sample-rulebook-r1",
    draft,
    traceId: "trace-review-bundle-sample-rulebook-r1",
    patchRecords: [patchRecord],
    reviewActions,
  });

  return {
    draft,
    reviewPatchBundle,
    reviewValidationFindings: validateReviewPatchBundle(draft, reviewPatchBundle),
    reviewableCandidateStates: buildReviewableCandidateStates(
      draft,
      reviewPatchBundle
    ),
    reviewPatchOverview: buildReviewPatchOverview(draft, reviewPatchBundle),
    preReviewCompileReadiness: buildCompileReadinessSnapshot(draft),
    postReviewCompileReadiness: buildCompileReadinessSnapshot(
      draft,
      reviewPatchBundle
    ),
  };
}

export const SAMPLE_REVIEW_FLOW_BUNDLE = createSampleReviewFlowBundle();

function requireEvidenceBlock(
  base: ReturnType<typeof createSampleDraftBundle>,
  evidenceBlockId: string
): EvidenceBlock {
  const evidenceBlock = base.evidenceBlocks.find(
    (item) => item.evidenceBlockId === evidenceBlockId
  );

  if (evidenceBlock === undefined) {
    throw new Error(`Missing sample evidence block '${evidenceBlockId}'.`);
  }

  return evidenceBlock;
}

function requireClause(
  base: ReturnType<typeof createSampleDraftBundle>,
  candidateClauseId: string
) {
  const clause = base.candidateClauses.find(
    (item) => item.candidateClauseId === candidateClauseId
  );

  if (clause === undefined) {
    throw new Error(`Missing sample clause '${candidateClauseId}'.`);
  }

  return clause;
}

function requireTerm(
  base: ReturnType<typeof createSampleDraftBundle>,
  candidateTermId: string
) {
  const term = base.candidateTerms.find(
    (item) => item.candidateTermId === candidateTermId
  );

  if (term === undefined) {
    throw new Error(`Missing sample term '${candidateTermId}'.`);
  }

  return term;
}

function requireIssue(
  base: ReturnType<typeof createSampleDraftBundle>,
  issueId: string
): Issue {
  const issue = base.issues.find((item) => item.issueId === issueId);

  if (issue === undefined) {
    throw new Error(`Missing sample issue '${issueId}'.`);
  }

  return issue;
}
