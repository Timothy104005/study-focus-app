import {
  CandidateClause,
  CandidateIngestionDraft,
  CandidateIngestionDraftId,
  CandidateTerm,
  CreateCandidateIngestionDraftInput,
  EvidenceBlock,
  Issue,
  SourceDocumentId,
  TraceId,
  createCandidateIngestionDraft,
} from "./contracts";
import {
  CandidateIngestionValidationFinding,
  validateCandidateIngestionDraft,
} from "./validation";

/**
 * Minimal document envelope for the ingestion-side pipeline seam.
 */
export interface RulebookDocumentInput {
  sourceDocumentId: SourceDocumentId;
  sourceRevisionId?: string;
  title?: string;
  rawText?: string;
}

/**
 * Snapshot of unconfirmed artifacts emitted by an upstream extractor.
 */
export interface CandidateIngestionSnapshot {
  evidenceBlocks: EvidenceBlock[];
  candidateClauses: CandidateClause[];
  candidateTerms: CandidateTerm[];
  issues: Issue[];
}

export interface MockIngestionPipelineInput
  extends RulebookDocumentInput,
    CandidateIngestionSnapshot {
  draftId: CandidateIngestionDraftId;
  traceId: TraceId;
}

export interface RulebookIngestionPipeline {
  buildDraft(input: MockIngestionPipelineInput): CandidateIngestionDraft;
}

export interface ValidatedDraftBuildResult {
  draft: CandidateIngestionDraft;
  findings: CandidateIngestionValidationFinding[];
}

export class MockRulebookIngestionPipeline
  implements RulebookIngestionPipeline
{
  buildDraft(input: MockIngestionPipelineInput): CandidateIngestionDraft {
    const draftInput: CreateCandidateIngestionDraftInput = {
      draftId: input.draftId,
      traceId: input.traceId,
      sourceDocumentId: input.sourceDocumentId,
      evidenceBlocks: input.evidenceBlocks,
      candidateClauses: input.candidateClauses,
      candidateTerms: input.candidateTerms,
      issues: input.issues,
    };

    if (input.sourceRevisionId !== undefined) {
      draftInput.sourceRevisionId = input.sourceRevisionId;
    }

    return createCandidateIngestionDraft(draftInput);
  }

  buildValidatedDraft(input: MockIngestionPipelineInput): ValidatedDraftBuildResult {
    const draft = this.buildDraft(input);

    return {
      draft,
      findings: validateCandidateIngestionDraft(draft),
    };
  }
}
