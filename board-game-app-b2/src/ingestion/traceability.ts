import {
  CandidateIngestionDraft,
  EvidenceBackedEntity,
  EvidenceBlock,
  EvidenceRef,
  TraceId,
  getEvidenceBackedEntityId,
} from "./contracts";
import { buildCandidateIngestionDraftIndex } from "./validation";

export interface ResolvedEvidenceRef {
  ref: EvidenceRef;
  evidenceBlock?: EvidenceBlock;
  isResolved: boolean;
}

export interface EntityTraceabilityRecord {
  entityKind: EvidenceBackedEntity["kind"];
  entityId: string;
  traceId: TraceId;
  parentTraceIds: TraceId[];
  evidence: ResolvedEvidenceRef[];
}

export function getEvidenceBackedEntities(
  draft: CandidateIngestionDraft
): EvidenceBackedEntity[] {
  return [...draft.candidateClauses, ...draft.candidateTerms, ...draft.issues];
}

export function resolveEvidenceRefsForEntity(
  draft: CandidateIngestionDraft,
  entity: EvidenceBackedEntity
): ResolvedEvidenceRef[] {
  const index = buildCandidateIngestionDraftIndex(draft);

  return entity.evidenceRefs.map((ref) => {
    const evidenceBlock = index.evidenceBlocksById.get(ref.evidenceBlockId);
    const resolvedRef: ResolvedEvidenceRef = {
      ref,
      isResolved: evidenceBlock !== undefined,
    };

    if (evidenceBlock !== undefined) {
      resolvedRef.evidenceBlock = evidenceBlock;
    }

    return resolvedRef;
  });
}

export function buildEntityTraceabilityRecord(
  draft: CandidateIngestionDraft,
  entity: EvidenceBackedEntity
): EntityTraceabilityRecord {
  return {
    entityKind: entity.kind,
    entityId: getEvidenceBackedEntityId(entity),
    traceId: entity.traceId,
    parentTraceIds: entity.parentTraceIds ?? [],
    evidence: resolveEvidenceRefsForEntity(draft, entity),
  };
}

export function buildDraftTraceabilityRecords(
  draft: CandidateIngestionDraft
): EntityTraceabilityRecord[] {
  return getEvidenceBackedEntities(draft).map((entity) =>
    buildEntityTraceabilityRecord(draft, entity)
  );
}
