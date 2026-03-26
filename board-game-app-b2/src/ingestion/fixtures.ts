import {
  CandidateClause,
  CandidateIngestionDraft,
  CandidateTerm,
  EvidenceBlock,
  Issue,
  createCandidateEntityRef,
  createCandidateIngestionDraft,
  createEvidenceRef,
} from "./contracts";
import {
  buildDraftTraceabilityRecords,
  EntityTraceabilityRecord,
} from "./traceability";
import {
  CandidateIngestionValidationFinding,
  validateCandidateIngestionDraft,
} from "./validation";

export interface SampleDraftBundle {
  evidenceBlocks: EvidenceBlock[];
  candidateClauses: CandidateClause[];
  candidateTerms: CandidateTerm[];
  issues: Issue[];
  draft: CandidateIngestionDraft;
  traceability: EntityTraceabilityRecord[];
  validationFindings: CandidateIngestionValidationFinding[];
}

export function createSampleDraftBundle(): SampleDraftBundle {
  const setupEvidence: EvidenceBlock = {
    kind: "evidence_block",
    evidenceBlockId: "ev-setup-1",
    traceId: "trace-evidence-setup-1",
    evidenceKind: "rule_text",
    sourceLocator: {
      sourceDocumentId: "rulebook-sample",
      sourceRevisionId: "r1",
      sectionPath: ["Setup"],
      pageRange: { start: 1, end: 1 },
      lineRange: { start: 1, end: 2 },
    },
    excerpt: "Each player draws 5 cards to form their starting hand.",
    normalizedExcerpt: "each player draws 5 cards to form their starting hand.",
    language: "en",
    tags: ["setup", "cards"],
  };

  const turnEvidence: EvidenceBlock = {
    kind: "evidence_block",
    evidenceBlockId: "ev-turn-1",
    traceId: "trace-evidence-turn-1",
    evidenceKind: "rule_text",
    sourceLocator: {
      sourceDocumentId: "rulebook-sample",
      sourceRevisionId: "r1",
      sectionPath: ["Turn Structure", "Draw Phase"],
      pageRange: { start: 3, end: 3 },
      lineRange: { start: 4, end: 5 },
    },
    excerpt: "At the start of your turn, draw 1 card from the deck.",
    normalizedExcerpt: "at the start of your turn, draw 1 card from the deck.",
    language: "en",
    tags: ["turn", "draw"],
  };

  const handLimitEvidence: EvidenceBlock = {
    kind: "evidence_block",
    evidenceBlockId: "ev-limit-1",
    traceId: "trace-evidence-limit-1",
    evidenceKind: "rule_text",
    sourceLocator: {
      sourceDocumentId: "rulebook-sample",
      sourceRevisionId: "r1",
      sectionPath: ["Turn Structure", "Draw Phase"],
      pageRange: { start: 3, end: 3 },
      lineRange: { start: 6, end: 7 },
    },
    excerpt: "If your hand already has 7 cards, you do not draw.",
    normalizedExcerpt: "if your hand already has 7 cards, you do not draw.",
    language: "en",
    tags: ["restriction", "draw"],
  };

  const startingHandTerm: CandidateTerm = {
    kind: "candidate_term",
    candidateTermId: "term-starting-hand",
    traceId: "trace-term-starting-hand",
    parentTraceIds: ["trace-evidence-setup-1"],
    termCategory: "resource",
    canonicalName: "starting hand",
    normalizedKey: "starting_hand",
    surfaceForms: ["starting hand", "hand"],
    candidateDefinition: "Cards drawn during setup before the first turn begins.",
    evidenceRefs: [createEvidenceRef(setupEvidence, "primary")],
    reviewState: "pending_review",
    relatedCandidateClauseIds: ["clause-setup-draw-5"],
  };

  const handLimitTerm: CandidateTerm = {
    kind: "candidate_term",
    candidateTermId: "term-hand-limit",
    traceId: "trace-term-hand-limit",
    parentTraceIds: ["trace-evidence-limit-1"],
    termCategory: "state",
    canonicalName: "hand limit",
    normalizedKey: "hand_limit",
    surfaceForms: ["7 cards", "hand already has 7 cards"],
    candidateDefinition: "State where a player already has the maximum hand size.",
    evidenceRefs: [createEvidenceRef(handLimitEvidence, "primary")],
    reviewState: "pending_review",
    relatedCandidateClauseIds: ["clause-draw-blocked-at-limit"],
  };

  const setupDrawClause: CandidateClause = {
    kind: "candidate_clause",
    candidateClauseId: "clause-setup-draw-5",
    traceId: "trace-clause-setup-draw-5",
    parentTraceIds: ["trace-evidence-setup-1"],
    clauseCategory: "setup",
    modality: "obligation",
    statement: "Each player starts the game by drawing 5 cards.",
    subjectText: "each player",
    effectText: "draw 5 cards",
    evidenceRefs: [createEvidenceRef(setupEvidence, "primary")],
    reviewState: "pending_review",
    relatedCandidateTermIds: ["term-starting-hand"],
  };

  const drawAtTurnStartClause: CandidateClause = {
    kind: "candidate_clause",
    candidateClauseId: "clause-draw-1-at-turn-start",
    traceId: "trace-clause-draw-1-at-turn-start",
    parentTraceIds: ["trace-evidence-turn-1"],
    clauseCategory: "turn_structure",
    modality: "obligation",
    statement: "At the start of your turn, draw 1 card.",
    subjectText: "active player",
    conditionText: "start of your turn",
    effectText: "draw 1 card from the deck",
    evidenceRefs: [createEvidenceRef(turnEvidence, "primary")],
    reviewState: "pending_review",
    linkedIssueIds: ["issue-draw-obligation-vs-restriction"],
  };

  const drawBlockedAtLimitClause: CandidateClause = {
    kind: "candidate_clause",
    candidateClauseId: "clause-draw-blocked-at-limit",
    traceId: "trace-clause-draw-blocked-at-limit",
    parentTraceIds: ["trace-evidence-limit-1", "trace-clause-draw-1-at-turn-start"],
    clauseCategory: "restriction",
    modality: "prohibition",
    statement: "A player with 7 cards in hand does not draw at turn start.",
    subjectText: "player with 7 cards in hand",
    conditionText: "start of your turn and hand already has 7 cards",
    effectText: "do not draw",
    evidenceRefs: [
      createEvidenceRef(handLimitEvidence, "primary"),
      createEvidenceRef(
        turnEvidence,
        "supporting",
        "Provides the draw action being restricted."
      ),
    ],
    reviewState: "pending_review",
    relatedCandidateTermIds: ["term-hand-limit"],
    linkedIssueIds: ["issue-draw-obligation-vs-restriction"],
  };

  const drawConflictIssue: Issue = {
    kind: "issue",
    issueId: "issue-draw-obligation-vs-restriction",
    traceId: "trace-issue-draw-obligation-vs-restriction",
    parentTraceIds: [
      "trace-clause-draw-1-at-turn-start",
      "trace-clause-draw-blocked-at-limit",
    ],
    issueKind: "ambiguity",
    severity: "medium",
    status: "open",
    title: "Clarify whether the hand-limit sentence is an exception or a contradiction.",
    description:
      "The draw-phase rule appears mandatory, while the hand-limit text blocks drawing. The candidate layer keeps both readings and records the conflict for review.",
    subjectRefs: [
      createCandidateEntityRef(drawAtTurnStartClause),
      createCandidateEntityRef(drawBlockedAtLimitClause),
    ],
    evidenceRefs: [
      createEvidenceRef(turnEvidence, "supporting"),
      createEvidenceRef(handLimitEvidence, "primary"),
    ],
    resolutionHint:
      "Confirm whether the second sentence is an explicit exception to the draw-phase rule.",
  };

  const evidenceBlocks: EvidenceBlock[] = [
    setupEvidence,
    turnEvidence,
    handLimitEvidence,
  ];
  const candidateTerms: CandidateTerm[] = [startingHandTerm, handLimitTerm];
  const candidateClauses: CandidateClause[] = [
    setupDrawClause,
    drawAtTurnStartClause,
    drawBlockedAtLimitClause,
  ];
  const issues: Issue[] = [drawConflictIssue];

  const draft = createCandidateIngestionDraft({
    draftId: "draft-sample-rulebook-r1",
    traceId: "trace-draft-sample-rulebook-r1",
    sourceDocumentId: "rulebook-sample",
    sourceRevisionId: "r1",
    evidenceBlocks,
    candidateClauses,
    candidateTerms,
    issues,
  });

  return {
    evidenceBlocks,
    candidateClauses,
    candidateTerms,
    issues,
    draft,
    traceability: buildDraftTraceabilityRecords(draft),
    validationFindings: validateCandidateIngestionDraft(draft),
  };
}

export const SAMPLE_DRAFT_BUNDLE = createSampleDraftBundle();
