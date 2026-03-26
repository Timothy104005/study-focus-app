import {
  ALLOWED_CONFIRMED_KINDS,
  CandidateEntityRef,
  CandidateIngestionDraft,
  ConfirmedIRBoundaryId,
  EvidenceRef,
  ISODateTimeString,
  Issue,
  IssueId,
  TraceId,
} from "./contracts";
import { buildCandidateIngestionDraftIndex } from "./validation";

export type PatchEntryId = string;
export type PatchRecordId = string;
export type ReviewActionId = string;
export type ReviewPatchBundleId = string;

export type PatchValue =
  | string
  | number
  | boolean
  | null
  | PatchValue[]
  | { [key: string]: PatchValue };

export interface ReviewIssueRef {
  kind: "issue";
  id: IssueId;
  traceId?: TraceId;
}

export type ReviewTargetRef = CandidateEntityRef | ReviewIssueRef;

export type PatchOperation = "replace" | "append" | "remove";

export interface PatchEntry {
  kind: "patch_entry";
  patchEntryId: PatchEntryId;
  traceId: TraceId;
  parentTraceIds?: TraceId[];
  target: ReviewTargetRef;
  fieldPath: string;
  op: PatchOperation;
  evidenceRefs: EvidenceRef[];
  rationale: string;
  previousValue?: PatchValue;
  nextValue?: PatchValue;
}

export type PatchRecordStatus =
  | "proposed"
  | "applied_to_candidate"
  | "queued_for_confirmed_handoff";

/**
 * Stable patch container for review-time edits.
 * Patch records stay on the candidate side of the boundary even if they inform later confirmed handoff.
 */
export interface PatchRecord {
  kind: "patch_record";
  patchRecordId: PatchRecordId;
  traceId: TraceId;
  parentTraceIds?: TraceId[];
  target: ReviewTargetRef;
  entries: PatchEntry[];
  status: PatchRecordStatus;
  evidenceRefs: EvidenceRef[];
  note?: string;
}

export type ReviewActionType =
  | "confirm"
  | "reject"
  | "edit"
  | "add_patch"
  | "mark_issue_unresolved"
  | "resolve_issue";

export interface ReviewActionBase {
  kind: "review_action";
  reviewActionId: ReviewActionId;
  traceId: TraceId;
  parentTraceIds?: TraceId[];
  actionType: ReviewActionType;
  target: ReviewTargetRef;
  evidenceRefs: EvidenceRef[];
  rationale: string;
  createdAt?: ISODateTimeString;
  actorId?: string;
  relatedPatchRecordIds?: PatchRecordId[];
}

export interface ConfirmCandidateAction extends ReviewActionBase {
  actionType: "confirm";
  target: CandidateEntityRef;
  confirmedBoundaryId: ConfirmedIRBoundaryId;
  confirmedKind: (typeof ALLOWED_CONFIRMED_KINDS)[number];
  confirmedArtifactId?: string;
}

export interface RejectCandidateAction extends ReviewActionBase {
  actionType: "reject";
  target: CandidateEntityRef;
  rejectionReason: string;
}

export interface EditCandidateAction extends ReviewActionBase {
  actionType: "edit";
  target: CandidateEntityRef;
  patchRecordId: PatchRecordId;
  editSummary: string;
}

export interface AddPatchAction extends ReviewActionBase {
  actionType: "add_patch";
  patchRecordId: PatchRecordId;
  patchSummary: string;
}

export interface MarkIssueUnresolvedAction extends ReviewActionBase {
  actionType: "mark_issue_unresolved";
  target: ReviewIssueRef;
  unresolvedReason: string;
}

export interface ResolveIssueAction extends ReviewActionBase {
  actionType: "resolve_issue";
  target: ReviewIssueRef;
  resolutionSummary: string;
}

export type ReviewAction =
  | ConfirmCandidateAction
  | RejectCandidateAction
  | EditCandidateAction
  | AddPatchAction
  | MarkIssueUnresolvedAction
  | ResolveIssueAction;

export type IssueTrackingStatus = "unresolved" | "resolved" | "deferred";

export interface IssueTrackingEntry {
  kind: "issue_tracking_entry";
  issueId: IssueId;
  traceId: TraceId;
  status: IssueTrackingStatus;
  sourceIssueStatus: Issue["status"];
  latestReviewActionId?: ReviewActionId;
  statusNote?: string;
  relatedPatchRecordIds?: PatchRecordId[];
}

/**
 * Review-time ledger for one candidate draft revision.
 * This does not store confirmed artifacts; it only records review actions and patch intent around the candidate layer.
 */
export interface ReviewPatchBundle {
  kind: "review_patch_bundle";
  reviewPatchBundleId: ReviewPatchBundleId;
  draftId: CandidateIngestionDraft["draftId"];
  traceId: TraceId;
  patchRecords: PatchRecord[];
  reviewActions: ReviewAction[];
  issueTracking: IssueTrackingEntry[];
}

export interface ReviewPatchValidationFinding {
  severity: "error" | "warning";
  code:
    | "duplicate_patch_record_id"
    | "duplicate_review_action_id"
    | "unknown_patch_target"
    | "unknown_action_target"
    | "unknown_patch_record"
    | "missing_patch_evidence"
    | "boundary_mismatch";
  message: string;
  entityKind: "patch_record" | "patch_entry" | "review_action" | "review_patch_bundle";
  entityId: string;
  relatedIds?: string[];
}

export interface CreatePatchEntryInput {
  patchEntryId: PatchEntryId;
  traceId: TraceId;
  target: ReviewTargetRef;
  fieldPath: string;
  op: PatchOperation;
  evidenceRefs: EvidenceRef[];
  rationale: string;
  parentTraceIds?: TraceId[];
  previousValue?: PatchValue;
  nextValue?: PatchValue;
}

export interface CreatePatchRecordInput {
  patchRecordId: PatchRecordId;
  traceId: TraceId;
  target: ReviewTargetRef;
  entries: PatchEntry[];
  status?: PatchRecordStatus;
  evidenceRefs: EvidenceRef[];
  parentTraceIds?: TraceId[];
  note?: string;
}

export interface CreateReviewPatchBundleInput {
  reviewPatchBundleId: ReviewPatchBundleId;
  draft: CandidateIngestionDraft;
  traceId: TraceId;
  patchRecords?: PatchRecord[];
  reviewActions?: ReviewAction[];
}

export function createIssueRef(
  issue: Pick<Issue, "issueId" | "traceId">
): ReviewIssueRef {
  return {
    kind: "issue",
    id: issue.issueId,
    traceId: issue.traceId,
  };
}

export function getReviewTargetId(target: ReviewTargetRef): string {
  return target.id;
}

export function createPatchEntry(input: CreatePatchEntryInput): PatchEntry {
  const entry: PatchEntry = {
    kind: "patch_entry",
    patchEntryId: input.patchEntryId,
    traceId: input.traceId,
    target: input.target,
    fieldPath: input.fieldPath,
    op: input.op,
    evidenceRefs: input.evidenceRefs,
    rationale: input.rationale,
  };

  if (input.parentTraceIds !== undefined) {
    entry.parentTraceIds = input.parentTraceIds;
  }

  if (input.previousValue !== undefined) {
    entry.previousValue = input.previousValue;
  }

  if (input.nextValue !== undefined) {
    entry.nextValue = input.nextValue;
  }

  return entry;
}

export function createPatchRecord(input: CreatePatchRecordInput): PatchRecord {
  const record: PatchRecord = {
    kind: "patch_record",
    patchRecordId: input.patchRecordId,
    traceId: input.traceId,
    target: input.target,
    entries: input.entries,
    status: input.status ?? "proposed",
    evidenceRefs: input.evidenceRefs,
  };

  if (input.parentTraceIds !== undefined) {
    record.parentTraceIds = input.parentTraceIds;
  }

  if (input.note !== undefined) {
    record.note = input.note;
  }

  return record;
}

/**
 * Derives the current unresolved/resolved view of issues from the draft plus review actions.
 */
export function buildIssueTrackingEntries(
  draft: CandidateIngestionDraft,
  reviewActions: ReviewAction[]
): IssueTrackingEntry[] {
  const trackingByIssueId = new Map<IssueId, IssueTrackingEntry>();

  draft.issues.forEach((issue) => {
    trackingByIssueId.set(issue.issueId, {
      kind: "issue_tracking_entry",
      issueId: issue.issueId,
      traceId: issue.traceId,
      status: getTrackingStatusFromIssue(issue),
      sourceIssueStatus: issue.status,
    });
  });

  reviewActions.forEach((action) => {
    if (action.target.kind !== "issue") {
      return;
    }

    const current = trackingByIssueId.get(action.target.id);

    if (current === undefined) {
      return;
    }

    current.latestReviewActionId = action.reviewActionId;

    if (action.relatedPatchRecordIds !== undefined) {
      current.relatedPatchRecordIds = action.relatedPatchRecordIds;
    }

    if (action.actionType === "mark_issue_unresolved") {
      current.status = "unresolved";
      current.statusNote = action.unresolvedReason;
    }

    if (action.actionType === "resolve_issue") {
      current.status = "resolved";
      current.statusNote = action.resolutionSummary;
    }
  });

  return [...trackingByIssueId.values()];
}

export function createReviewPatchBundle(
  input: CreateReviewPatchBundleInput
): ReviewPatchBundle {
  const patchRecords = input.patchRecords ?? [];
  const reviewActions = input.reviewActions ?? [];

  return {
    kind: "review_patch_bundle",
    reviewPatchBundleId: input.reviewPatchBundleId,
    draftId: input.draft.draftId,
    traceId: input.traceId,
    patchRecords,
    reviewActions,
    issueTracking: buildIssueTrackingEntries(input.draft, reviewActions),
  };
}

/**
 * Structural validation for the review/patch layer.
 * Keeps contract drift or dangling refs separate from gameplay issues tracked in the draft itself.
 */
export function validateReviewPatchBundle(
  draft: CandidateIngestionDraft,
  bundle: ReviewPatchBundle
): ReviewPatchValidationFinding[] {
  const findings: ReviewPatchValidationFinding[] = [];
  const draftIndex = buildCandidateIngestionDraftIndex(draft);
  const patchRecordIds = new Set<PatchRecordId>();
  const reviewActionIds = new Set<ReviewActionId>();
  const patchRecordMap = new Map<PatchRecordId, PatchRecord>();

  bundle.patchRecords.forEach((record) => {
    if (patchRecordIds.has(record.patchRecordId)) {
      findings.push({
        severity: "error",
        code: "duplicate_patch_record_id",
        message: `Patch record '${record.patchRecordId}' is duplicated.`,
        entityKind: "patch_record",
        entityId: record.patchRecordId,
      });
    }

    patchRecordIds.add(record.patchRecordId);
    patchRecordMap.set(record.patchRecordId, record);

    if (!reviewTargetExists(draftIndex, record.target)) {
      findings.push({
        severity: "error",
        code: "unknown_patch_target",
        message: `Patch record target '${record.target.id}' does not resolve in the draft.`,
        entityKind: "patch_record",
        entityId: record.patchRecordId,
        relatedIds: [record.target.id],
      });
    }

    record.entries.forEach((entry) => {
      if (entry.evidenceRefs.length === 0) {
        findings.push({
          severity: "warning",
          code: "missing_patch_evidence",
          message: `Patch entry '${entry.patchEntryId}' has no evidence refs.`,
          entityKind: "patch_entry",
          entityId: entry.patchEntryId,
        });
      }
    });
  });

  bundle.reviewActions.forEach((action) => {
    if (reviewActionIds.has(action.reviewActionId)) {
      findings.push({
        severity: "error",
        code: "duplicate_review_action_id",
        message: `Review action '${action.reviewActionId}' is duplicated.`,
        entityKind: "review_action",
        entityId: action.reviewActionId,
      });
    }

    reviewActionIds.add(action.reviewActionId);

    if (!reviewTargetExists(draftIndex, action.target)) {
      findings.push({
        severity: "error",
        code: "unknown_action_target",
        message: `Review action target '${action.target.id}' does not resolve in the draft.`,
        entityKind: "review_action",
        entityId: action.reviewActionId,
        relatedIds: [action.target.id],
      });
    }

    if (
      (action.actionType === "add_patch" || action.actionType === "edit") &&
      !patchRecordMap.has(action.patchRecordId)
    ) {
      findings.push({
        severity: "error",
        code: "unknown_patch_record",
        message: `Review action references missing patch record '${action.patchRecordId}'.`,
        entityKind: "review_action",
        entityId: action.reviewActionId,
        relatedIds: [action.patchRecordId],
      });
    }

    if (
      action.actionType === "confirm" &&
      action.confirmedBoundaryId !== draft.confirmedIRBoundary.confirmedIRBoundaryId
    ) {
      findings.push({
        severity: "error",
        code: "boundary_mismatch",
        message: "Confirm action points at a different confirmed boundary id.",
        entityKind: "review_action",
        entityId: action.reviewActionId,
        relatedIds: [
          action.confirmedBoundaryId,
          draft.confirmedIRBoundary.confirmedIRBoundaryId,
        ],
      });
    }
  });

  return findings;
}

function getTrackingStatusFromIssue(issue: Issue): IssueTrackingStatus {
  if (issue.status === "resolved") {
    return "resolved";
  }

  if (issue.status === "deferred") {
    return "deferred";
  }

  return "unresolved";
}

function reviewTargetExists(
  draftIndex: ReturnType<typeof buildCandidateIngestionDraftIndex>,
  target: ReviewTargetRef
): boolean {
  if (target.kind === "candidate_clause") {
    return draftIndex.candidateClausesById.has(target.id);
  }

  if (target.kind === "candidate_term") {
    return draftIndex.candidateTermsById.has(target.id);
  }

  return draftIndex.issuesById.has(target.id);
}
