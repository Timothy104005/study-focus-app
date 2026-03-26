import {
  ALLOWED_CONFIRMED_KINDS,
  BLOCKED_CANDIDATE_KINDS,
  CandidateClause,
  CandidateClauseId,
  CandidateIngestionDraft,
  CandidateTerm,
  CandidateTermId,
  EvidenceBlock,
  EvidenceBlockId,
  Issue,
  IssueId,
  TraceId,
} from "./contracts";

export interface CandidateIngestionDraftIndex {
  evidenceBlocksById: Map<EvidenceBlockId, EvidenceBlock>;
  candidateClausesById: Map<CandidateClauseId, CandidateClause>;
  candidateTermsById: Map<CandidateTermId, CandidateTerm>;
  issuesById: Map<IssueId, Issue>;
}

export type ValidationSeverity = "error" | "warning";

export interface CandidateIngestionValidationFinding {
  severity: ValidationSeverity;
  code:
    | "duplicate_id"
    | "missing_evidence"
    | "unknown_evidence_ref"
    | "unknown_candidate_term_ref"
    | "unknown_candidate_clause_ref"
    | "unknown_issue_ref"
    | "unknown_issue_subject_ref"
    | "boundary_source_mismatch"
    | "boundary_allowlist_mismatch"
    | "boundary_blocklist_mismatch";
  message: string;
  entityKind:
    | "candidate_ingestion_draft"
    | "evidence_block"
    | "candidate_clause"
    | "candidate_term"
    | "issue"
    | "confirmed_ir_boundary_placeholder";
  entityId: string;
  relatedIds?: string[];
}

/**
 * Builds stable lookup maps for review-time tools and patch flows.
 */
export function buildCandidateIngestionDraftIndex(
  draft: CandidateIngestionDraft
): CandidateIngestionDraftIndex {
  return {
    evidenceBlocksById: buildMap(draft.evidenceBlocks, (item) => item.evidenceBlockId),
    candidateClausesById: buildMap(
      draft.candidateClauses,
      (item) => item.candidateClauseId
    ),
    candidateTermsById: buildMap(draft.candidateTerms, (item) => item.candidateTermId),
    issuesById: buildMap(draft.issues, (item) => item.issueId),
  };
}

/**
 * Collects every trace identifier present in the draft for debugging or lineage export.
 */
export function collectDraftTraceIds(draft: CandidateIngestionDraft): TraceId[] {
  const traceIds = new Set<TraceId>();

  traceIds.add(draft.traceId);
  draft.evidenceBlocks.forEach((item) => addTraceIds(traceIds, item.traceId, item.parentTraceIds));
  draft.candidateClauses.forEach((item) =>
    addTraceIds(traceIds, item.traceId, item.parentTraceIds)
  );
  draft.candidateTerms.forEach((item) =>
    addTraceIds(traceIds, item.traceId, item.parentTraceIds)
  );
  draft.issues.forEach((item) => addTraceIds(traceIds, item.traceId, item.parentTraceIds));
  addTraceIds(traceIds, draft.confirmedIRBoundary.traceId);

  return [...traceIds];
}

/**
 * Structural validation only. Domain ambiguities belong in `Issue`, not here.
 */
export function validateCandidateIngestionDraft(
  draft: CandidateIngestionDraft
): CandidateIngestionValidationFinding[] {
  const findings: CandidateIngestionValidationFinding[] = [];
  const index = buildCandidateIngestionDraftIndex(draft);

  appendDuplicateIdFindings(findings, "evidence_block", draft.evidenceBlocks, (item) => item.evidenceBlockId);
  appendDuplicateIdFindings(
    findings,
    "candidate_clause",
    draft.candidateClauses,
    (item) => item.candidateClauseId
  );
  appendDuplicateIdFindings(
    findings,
    "candidate_term",
    draft.candidateTerms,
    (item) => item.candidateTermId
  );
  appendDuplicateIdFindings(findings, "issue", draft.issues, (item) => item.issueId);

  draft.candidateClauses.forEach((clause) => {
    if (clause.evidenceRefs.length === 0) {
      findings.push({
        severity: "error",
        code: "missing_evidence",
        message: "Candidate clause has no evidence refs.",
        entityKind: "candidate_clause",
        entityId: clause.candidateClauseId,
      });
    }

    appendUnknownEvidenceFindings(findings, index, "candidate_clause", clause.candidateClauseId, clause.evidenceRefs.map((item) => item.evidenceBlockId));
    appendUnknownRefFindings(
      findings,
      "unknown_candidate_term_ref",
      "candidate_clause",
      clause.candidateClauseId,
      clause.relatedCandidateTermIds ?? [],
      index.candidateTermsById
    );
    appendUnknownRefFindings(
      findings,
      "unknown_issue_ref",
      "candidate_clause",
      clause.candidateClauseId,
      clause.linkedIssueIds ?? [],
      index.issuesById
    );
  });

  draft.candidateTerms.forEach((term) => {
    if (term.evidenceRefs.length === 0) {
      findings.push({
        severity: "error",
        code: "missing_evidence",
        message: "Candidate term has no evidence refs.",
        entityKind: "candidate_term",
        entityId: term.candidateTermId,
      });
    }

    appendUnknownEvidenceFindings(findings, index, "candidate_term", term.candidateTermId, term.evidenceRefs.map((item) => item.evidenceBlockId));
    appendUnknownRefFindings(
      findings,
      "unknown_candidate_clause_ref",
      "candidate_term",
      term.candidateTermId,
      term.relatedCandidateClauseIds ?? [],
      index.candidateClausesById
    );
    appendUnknownRefFindings(
      findings,
      "unknown_issue_ref",
      "candidate_term",
      term.candidateTermId,
      term.linkedIssueIds ?? [],
      index.issuesById
    );
  });

  draft.issues.forEach((issue) => {
    if (issue.evidenceRefs.length === 0) {
      findings.push({
        severity: "warning",
        code: "missing_evidence",
        message: "Issue has no evidence refs.",
        entityKind: "issue",
        entityId: issue.issueId,
      });
    }

    appendUnknownEvidenceFindings(findings, index, "issue", issue.issueId, issue.evidenceRefs.map((item) => item.evidenceBlockId));

    issue.subjectRefs.forEach((subjectRef) => {
      const isKnown =
        subjectRef.kind === "candidate_clause"
          ? index.candidateClausesById.has(subjectRef.id as CandidateClauseId)
          : index.candidateTermsById.has(subjectRef.id as CandidateTermId);

      if (!isKnown) {
        findings.push({
          severity: "error",
          code: "unknown_issue_subject_ref",
          message: `Issue references missing ${subjectRef.kind} '${subjectRef.id}'.`,
          entityKind: "issue",
          entityId: issue.issueId,
          relatedIds: [subjectRef.id],
        });
      }
    });
  });

  if (draft.confirmedIRBoundary.sourceDraftId !== draft.draftId) {
    findings.push({
      severity: "error",
      code: "boundary_source_mismatch",
      message: "Confirmed IR boundary points at a different draft id.",
      entityKind: "confirmed_ir_boundary_placeholder",
      entityId: draft.confirmedIRBoundary.confirmedIRBoundaryId,
      relatedIds: [draft.draftId, draft.confirmedIRBoundary.sourceDraftId],
    });
  }

  if (
    draft.confirmedIRBoundary.allowedConfirmedKinds.length !==
      ALLOWED_CONFIRMED_KINDS.length ||
    draft.confirmedIRBoundary.allowedConfirmedKinds.some(
      (kind, index) => kind !== ALLOWED_CONFIRMED_KINDS[index]
    )
  ) {
    findings.push({
      severity: "error",
      code: "boundary_allowlist_mismatch",
      message: "Confirmed IR boundary allowlist drifted from the confirmed-layer contract.",
      entityKind: "confirmed_ir_boundary_placeholder",
      entityId: draft.confirmedIRBoundary.confirmedIRBoundaryId,
      relatedIds: [...draft.confirmedIRBoundary.allowedConfirmedKinds],
    });
  }

  if (
    draft.confirmedIRBoundary.blockedCandidateKinds.length !==
      BLOCKED_CANDIDATE_KINDS.length ||
    draft.confirmedIRBoundary.blockedCandidateKinds.some(
      (kind, index) => kind !== BLOCKED_CANDIDATE_KINDS[index]
    )
  ) {
    findings.push({
      severity: "error",
      code: "boundary_blocklist_mismatch",
      message: "Confirmed IR boundary blocklist drifted from the candidate-layer contract.",
      entityKind: "confirmed_ir_boundary_placeholder",
      entityId: draft.confirmedIRBoundary.confirmedIRBoundaryId,
      relatedIds: [...draft.confirmedIRBoundary.blockedCandidateKinds],
    });
  }

  return findings;
}

function buildMap<T>(
  items: T[],
  getId: (item: T) => string
): Map<string, T> {
  const map = new Map<string, T>();

  items.forEach((item) => {
    map.set(getId(item), item);
  });

  return map;
}

function addTraceIds(
  traceIds: Set<TraceId>,
  traceId: TraceId,
  parentTraceIds?: TraceId[]
): void {
  traceIds.add(traceId);
  parentTraceIds?.forEach((item) => traceIds.add(item));
}

function appendDuplicateIdFindings<T>(
  findings: CandidateIngestionValidationFinding[],
  entityKind:
    | "evidence_block"
    | "candidate_clause"
    | "candidate_term"
    | "issue",
  items: T[],
  getId: (item: T) => string
): void {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const id = getId(item);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  });

  counts.forEach((count, id) => {
    if (count > 1) {
      findings.push({
        severity: "error",
        code: "duplicate_id",
        message: `${entityKind} id '${id}' is duplicated ${count} times.`,
        entityKind,
        entityId: id,
      });
    }
  });
}

function appendUnknownEvidenceFindings(
  findings: CandidateIngestionValidationFinding[],
  index: CandidateIngestionDraftIndex,
  entityKind: "candidate_clause" | "candidate_term" | "issue",
  entityId: string,
  evidenceBlockIds: EvidenceBlockId[]
): void {
  evidenceBlockIds.forEach((evidenceBlockId) => {
    if (!index.evidenceBlocksById.has(evidenceBlockId)) {
      findings.push({
        severity: "error",
        code: "unknown_evidence_ref",
        message: `Missing evidence block '${evidenceBlockId}'.`,
        entityKind,
        entityId,
        relatedIds: [evidenceBlockId],
      });
    }
  });
}

function appendUnknownRefFindings<T>(
  findings: CandidateIngestionValidationFinding[],
  code:
    | "unknown_candidate_term_ref"
    | "unknown_candidate_clause_ref"
    | "unknown_issue_ref",
  entityKind: "candidate_clause" | "candidate_term",
  entityId: string,
  relatedIds: string[],
  knownItems: Map<string, T>
): void {
  relatedIds.forEach((relatedId) => {
    if (!knownItems.has(relatedId)) {
      findings.push({
        severity: "warning",
        code,
        message: `Reference '${relatedId}' does not resolve.`,
        entityKind,
        entityId,
        relatedIds: [relatedId],
      });
    }
  });
}
