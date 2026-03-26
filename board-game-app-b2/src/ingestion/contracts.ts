export type TraceId = string;
export type SourceDocumentId = string;
export type EvidenceBlockId = string;
export type CandidateClauseId = string;
export type CandidateTermId = string;
export type IssueId = string;
export type CandidateIngestionDraftId = string;
export type ConfirmedIRBoundaryId = string;
export type ISODateTimeString = string;
export const ALLOWED_CONFIRMED_KINDS = [
  "confirmed_clause",
  "confirmed_term",
  "resolved_issue",
] as const;
export const BLOCKED_CANDIDATE_KINDS = [
  "candidate_clause",
  "candidate_term",
  "issue",
] as const;

export interface IntegerRange {
  start: number;
  end: number;
}

export interface SourceLocator {
  sourceDocumentId: SourceDocumentId;
  sourceRevisionId?: string;
  sectionPath: string[];
  pageRange?: IntegerRange;
  lineRange?: IntegerRange;
  charRange?: IntegerRange;
  sourceUri?: string;
}

export type EvidenceKind =
  | "rule_text"
  | "example"
  | "glossary"
  | "component_list"
  | "faq"
  | "errata"
  | "other";

/**
 * Smallest source-backed excerpt that other ingestion artifacts can cite.
 * Evidence is centralized here so candidate records stay reviewable and traceable.
 */
export interface EvidenceBlock {
  kind: "evidence_block";
  evidenceBlockId: EvidenceBlockId;
  traceId: TraceId;
  parentTraceIds?: TraceId[];
  evidenceKind: EvidenceKind;
  sourceLocator: SourceLocator;
  excerpt: string;
  normalizedExcerpt?: string;
  language?: string;
  capturedAt?: ISODateTimeString;
  tags?: string[];
  metadata?: Record<string, string | number | boolean | null>;
}

export type EvidenceRefRole = "primary" | "supporting" | "counterexample";

export interface EvidenceRef {
  evidenceBlockId: EvidenceBlockId;
  traceId: TraceId;
  role: EvidenceRefRole;
  rationale?: string;
}

export type CandidateReviewState =
  | "pending_review"
  | "flagged"
  | "superseded"
  | "rejected";

/**
 * Shared ingestion-layer shape for any unconfirmed gameplay interpretation.
 * Review state intentionally stops short of any confirmed/accepted terminal state.
 */
export interface CandidateBase {
  traceId: TraceId;
  parentTraceIds?: TraceId[];
  evidenceRefs: EvidenceRef[];
  reviewState: CandidateReviewState;
  notes?: string[];
}

export type ClauseCategory =
  | "definition"
  | "setup"
  | "turn_structure"
  | "action"
  | "restriction"
  | "cost"
  | "trigger"
  | "resolution"
  | "scoring"
  | "win_condition"
  | "exception"
  | "other";

export type ClauseModality =
  | "obligation"
  | "permission"
  | "prohibition"
  | "sequence"
  | "definition"
  | "fact"
  | "scoring"
  | "terminal_condition"
  | "unknown";

/**
 * Candidate interpretation of a rulebook statement.
 * `statement` is the reviewer-facing summary, while the optional text fields
 * preserve lighter structure without committing to a full rules IR yet.
 */
export interface CandidateClause extends CandidateBase {
  kind: "candidate_clause";
  candidateClauseId: CandidateClauseId;
  clauseCategory: ClauseCategory;
  modality: ClauseModality;
  statement: string;
  subjectText?: string;
  conditionText?: string;
  effectText?: string;
  exceptionText?: string;
  relatedCandidateTermIds?: CandidateTermId[];
  linkedIssueIds?: IssueId[];
}

export type TermCategory =
  | "actor"
  | "action"
  | "resource"
  | "state"
  | "phase"
  | "location"
  | "component"
  | "keyword"
  | "numeric_value"
  | "other";

/**
 * Candidate vocabulary entry extracted during ingestion.
 * `normalizedKey` is optional so downstream reviewers can dedupe equivalent terms.
 */
export interface CandidateTerm extends CandidateBase {
  kind: "candidate_term";
  candidateTermId: CandidateTermId;
  termCategory: TermCategory;
  canonicalName: string;
  normalizedKey?: string;
  surfaceForms: string[];
  candidateDefinition?: string;
  relatedCandidateClauseIds?: CandidateClauseId[];
  linkedIssueIds?: IssueId[];
}

export type CandidateEntity = CandidateClause | CandidateTerm;
export type EvidenceBackedEntity = CandidateEntity | Issue;
export type CandidateEntityKind = CandidateEntity["kind"];
export type IssueSubjectKind = CandidateEntityKind;

export interface CandidateEntityRef {
  kind: CandidateEntityKind;
  id: CandidateClauseId | CandidateTermId;
  traceId?: TraceId;
}

export type IssueSubjectRef = CandidateEntityRef;

export type IssueKind =
  | "ambiguity"
  | "contradiction"
  | "gap"
  | "unsupported_inference"
  | "term_collision";

export type IssueSeverity = "low" | "medium" | "high" | "blocking";
export type IssueStatus = "open" | "resolved" | "deferred";

/**
 * Review-time finding about the candidate layer itself.
 * This captures gameplay ambiguity or contradiction, not schema validation errors.
 */
export interface Issue {
  kind: "issue";
  issueId: IssueId;
  traceId: TraceId;
  parentTraceIds?: TraceId[];
  issueKind: IssueKind;
  severity: IssueSeverity;
  status: IssueStatus;
  title: string;
  description: string;
  subjectRefs: IssueSubjectRef[];
  evidenceRefs: EvidenceRef[];
  resolutionHint?: string;
}

/**
 * Hard handoff marker between the candidate layer and a future confirmed IR package.
 * Keeping this explicit helps prevent "candidate" records from being treated as compiled truth.
 */
export interface ConfirmedIRBoundaryPlaceholder {
  kind: "confirmed_ir_boundary_placeholder";
  confirmedIRBoundaryId: ConfirmedIRBoundaryId;
  traceId: TraceId;
  sourceDraftId: CandidateIngestionDraftId;
  status: "awaiting_confirmation";
  allowedConfirmedKinds: typeof ALLOWED_CONFIRMED_KINDS;
  blockedCandidateKinds: typeof BLOCKED_CANDIDATE_KINDS;
  note: string;
}

/**
 * Envelope for all ingestion outputs derived from a single source document revision.
 */
export interface CandidateIngestionDraft {
  kind: "candidate_ingestion_draft";
  draftId: CandidateIngestionDraftId;
  traceId: TraceId;
  sourceDocumentId: SourceDocumentId;
  sourceRevisionId?: string;
  evidenceBlocks: EvidenceBlock[];
  candidateClauses: CandidateClause[];
  candidateTerms: CandidateTerm[];
  issues: Issue[];
  confirmedIRBoundary: ConfirmedIRBoundaryPlaceholder;
}

export interface CreateCandidateIngestionDraftInput {
  draftId: CandidateIngestionDraftId;
  traceId: TraceId;
  sourceDocumentId: SourceDocumentId;
  sourceRevisionId?: string;
  evidenceBlocks?: EvidenceBlock[];
  candidateClauses?: CandidateClause[];
  candidateTerms?: CandidateTerm[];
  issues?: Issue[];
}

export function createEvidenceRef(
  evidenceBlock: Pick<EvidenceBlock, "evidenceBlockId" | "traceId">,
  role: EvidenceRefRole = "primary",
  rationale?: string
): EvidenceRef {
  const evidenceRef: EvidenceRef = {
    evidenceBlockId: evidenceBlock.evidenceBlockId,
    traceId: evidenceBlock.traceId,
    role,
  };

  if (rationale !== undefined) {
    evidenceRef.rationale = rationale;
  }

  return evidenceRef;
}

export function getCandidateEntityId(
  entity: CandidateEntity
): CandidateClauseId | CandidateTermId {
  return entity.kind === "candidate_clause"
    ? entity.candidateClauseId
    : entity.candidateTermId;
}

export function getEvidenceBackedEntityId(entity: EvidenceBackedEntity): string {
  return entity.kind === "issue" ? entity.issueId : getCandidateEntityId(entity);
}

export function createCandidateEntityRef(
  entity:
    | Pick<CandidateClause, "kind" | "candidateClauseId" | "traceId">
    | Pick<CandidateTerm, "kind" | "candidateTermId" | "traceId">
): CandidateEntityRef {
  const ref: CandidateEntityRef = {
    kind: entity.kind,
    id:
      entity.kind === "candidate_clause"
        ? entity.candidateClauseId
        : entity.candidateTermId,
  };

  if (entity.traceId !== undefined) {
    ref.traceId = entity.traceId;
  }

  return ref;
}

export function createConfirmedIRBoundaryPlaceholder(
  sourceDraftId: CandidateIngestionDraftId,
  traceId: TraceId
): ConfirmedIRBoundaryPlaceholder {
  return {
    kind: "confirmed_ir_boundary_placeholder",
    confirmedIRBoundaryId: `${sourceDraftId}:confirmed-boundary`,
    traceId,
    sourceDraftId,
    status: "awaiting_confirmation",
    allowedConfirmedKinds: ALLOWED_CONFIRMED_KINDS,
    blockedCandidateKinds: BLOCKED_CANDIDATE_KINDS,
    note:
      "Candidate artifacts must be reviewed and promoted into a separate confirmed IR package before they cross this boundary.",
  };
}

export function createCandidateIngestionDraft(
  input: CreateCandidateIngestionDraftInput
): CandidateIngestionDraft {
  const draft: CandidateIngestionDraft = {
    kind: "candidate_ingestion_draft",
    draftId: input.draftId,
    traceId: input.traceId,
    sourceDocumentId: input.sourceDocumentId,
    evidenceBlocks: input.evidenceBlocks ?? [],
    candidateClauses: input.candidateClauses ?? [],
    candidateTerms: input.candidateTerms ?? [],
    issues: input.issues ?? [],
    confirmedIRBoundary: createConfirmedIRBoundaryPlaceholder(
      input.draftId,
      input.traceId
    ),
  };

  if (input.sourceRevisionId !== undefined) {
    draft.sourceRevisionId = input.sourceRevisionId;
  }

  return draft;
}
