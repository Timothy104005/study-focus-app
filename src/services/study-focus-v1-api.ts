import {
  API_ROUTE_PATTERNS,
  type DiscussionPostDto,
  type ExamCountdownDto,
  type InterruptionReason,
  type ModerationActionResultDto,
  type StudySessionDto,
  buildDiscussionPostDetailRoute,
  buildDiscussionPostHideRoute,
  buildDiscussionPostReportRoute,
  buildExamCountdownDetailRoute,
  buildStudySessionFlagRoute,
  buildStudySessionInterruptRoute,
  buildStudySessionPauseRoute,
  buildStudySessionResumeRoute,
  buildStudySessionStopRoute,
} from "@/contracts";
import { requestJson } from "@/services/api-client";

export interface CreateStudySessionRequest {
  groupId: string;
  title: string;
  notes?: string | null;
}

export interface UpsertExamCountdownRequest {
  examAt?: string;
  groupId?: string | null;
  notes?: string | null;
  subject?: string | null;
  title?: string;
}

export interface StudyFocusV1Api {
  listOpenStudySessions(): Promise<StudySessionDto[]>;
  createStudySession(input: CreateStudySessionRequest): Promise<StudySessionDto>;
  pauseStudySession(sessionId: string): Promise<StudySessionDto>;
  resumeStudySession(sessionId: string): Promise<StudySessionDto>;
  stopStudySession(sessionId: string): Promise<StudySessionDto>;
  interruptStudySession(
    sessionId: string,
    reason: InterruptionReason | "tab_blur",
  ): Promise<StudySessionDto>;
  reportStudySessionInterruption(
    sessionId: string,
    reason: InterruptionReason,
  ): Promise<StudySessionDto>;
  flagStudySessionForReview(
    sessionId: string,
    reason?: string,
  ): Promise<StudySessionDto>;
  reportDiscussionPost(
    postId: string,
    reason?: string,
  ): Promise<ModerationActionResultDto>;
  hideDiscussionPost(
    postId: string,
    reason?: string,
  ): Promise<DiscussionPostDto>;
  deleteDiscussionPost(postId: string): Promise<{ id: string }>;
  createExamCountdown(input: Required<Pick<UpsertExamCountdownRequest, "examAt" | "title">> &
    UpsertExamCountdownRequest): Promise<ExamCountdownDto>;
  updateExamCountdown(
    countdownId: string,
    input: UpsertExamCountdownRequest,
  ): Promise<ExamCountdownDto>;
  deleteExamCountdown(countdownId: string): Promise<{ id: string }>;
}

let cachedApi: StudyFocusV1Api | null = null;

function createStudyFocusV1Api(): StudyFocusV1Api {
  return {
    listOpenStudySessions() {
      return requestJson<StudySessionDto[]>(
        `${API_ROUTE_PATTERNS.studySessions}?openOnly=true`,
      );
    },
    createStudySession(input) {
      return requestJson<StudySessionDto>(API_ROUTE_PATTERNS.studySessions, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    pauseStudySession(sessionId) {
      return requestJson<StudySessionDto>(buildStudySessionPauseRoute(sessionId), {
        method: "POST",
      });
    },
    resumeStudySession(sessionId) {
      return requestJson<StudySessionDto>(buildStudySessionResumeRoute(sessionId), {
        method: "POST",
      });
    },
    stopStudySession(sessionId) {
      return requestJson<StudySessionDto>(buildStudySessionStopRoute(sessionId), {
        method: "POST",
      });
    },
    interruptStudySession(sessionId, reason) {
      const mappedReason: InterruptionReason =
        reason === "tab_blur" ? "tab_hidden" : reason;
      return requestJson<StudySessionDto>(buildStudySessionInterruptRoute(sessionId), {
        method: "POST",
        body: JSON.stringify({ reason: mappedReason }),
      });
    },
    reportStudySessionInterruption(sessionId, reason) {
      return requestJson<StudySessionDto>(buildStudySessionInterruptRoute(sessionId), {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },
    flagStudySessionForReview(sessionId, reason) {
      return requestJson<StudySessionDto>(buildStudySessionFlagRoute(sessionId), {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },
    reportDiscussionPost(postId, reason) {
      return requestJson<ModerationActionResultDto>(buildDiscussionPostReportRoute(postId), {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },
    hideDiscussionPost(postId, reason) {
      return requestJson<DiscussionPostDto>(buildDiscussionPostHideRoute(postId), {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },
    deleteDiscussionPost(postId) {
      return requestJson<{ id: string }>(buildDiscussionPostDetailRoute(postId), {
        method: "DELETE",
      });
    },
    createExamCountdown(input) {
      return requestJson<ExamCountdownDto>(API_ROUTE_PATTERNS.examCountdowns, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    updateExamCountdown(countdownId, input) {
      return requestJson<ExamCountdownDto>(buildExamCountdownDetailRoute(countdownId), {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },
    deleteExamCountdown(countdownId) {
      return requestJson<{ id: string }>(buildExamCountdownDetailRoute(countdownId), {
        method: "DELETE",
      });
    },
  };
}

export function getStudyFocusV1Api() {
  if (!cachedApi) {
    cachedApi = createStudyFocusV1Api();
  }

  return cachedApi;
}
