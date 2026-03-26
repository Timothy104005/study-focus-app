import type {
  CreateExamInput,
  CreateFocusSessionInput,
  CreateGroupInput,
  CreateGroupPostInput,
  DashboardData,
  Exam,
  FocusOverview,
  FocusSession,
  GroupDetail,
  GroupPost,
  GroupSummary,
  JoinGroupInput,
  LegacyStudyFocusApi,
  LeaderboardData,
  ModerationActionResult,
  OtpRequestResult,
  ProfileStats,
  UpdateExamInput,
} from "@/contracts/study-focus";
import {
  buildDiscussionPostDetailRoute,
  buildDiscussionPostHideRoute,
  buildDiscussionPostReportRoute,
  buildExamCountdownDetailRoute,
  buildStudySessionFlagRoute,
  type ExamCountdownDto,
} from "@/contracts";
import { requestJson } from "@/services/api-client";

function buildExamAt(date: string) {
  return new Date(`${date}T12:00:00+08:00`).toISOString();
}

function mapExamCountdownToExam(countdown: ExamCountdownDto): Exam {
  return {
    id: countdown.id,
    title: countdown.title,
    date: countdown.examAt.slice(0, 10),
    type: countdown.groupId ? "official" : "custom",
    subjectScope: countdown.subject ?? countdown.title,
  };
}

function mapExamMutationInput(input: UpdateExamInput) {
  const payload: {
    examAt?: string;
    subject?: string | null;
    title?: string;
  } = {};

  if (input.date !== undefined) {
    payload.examAt = buildExamAt(input.date);
  }

  if (input.subjectScope !== undefined) {
    payload.subject = input.subjectScope.trim() || null;
  }

  if (input.title !== undefined) {
    payload.title = input.title.trim();
  }

  return payload;
}

export function createHttpStudyFocusApi(baseUrl: string): LegacyStudyFocusApi {
  return {
    getDashboard() {
      return requestJson<DashboardData>("/dashboard", undefined, { baseUrl });
    },
    getFocusOverview() {
      return requestJson<FocusOverview>("/focus/overview", undefined, {
        baseUrl,
      });
    },
    createFocusSession(input: CreateFocusSessionInput) {
      return requestJson<FocusSession>(
        "/focus/sessions",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        { baseUrl },
      );
    },
    getLeaderboard(classId) {
      const query = classId ? `?classId=${encodeURIComponent(classId)}` : "";
      return requestJson<LeaderboardData>(`/leaderboard${query}`, undefined, {
        baseUrl,
      });
    },
    getGroups() {
      return requestJson<GroupSummary[]>("/groups", undefined, { baseUrl });
    },
    createGroup(input: CreateGroupInput) {
      return requestJson<GroupSummary>(
        "/groups",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        { baseUrl },
      );
    },
    joinGroup(input: JoinGroupInput) {
      return requestJson<GroupSummary>(
        "/groups/join",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        { baseUrl },
      );
    },
    getGroupDetail(groupId: string) {
      return requestJson<GroupDetail>(`/groups/${groupId}`, undefined, {
        baseUrl,
      });
    },
    createGroupPost(groupId: string, input: CreateGroupPostInput) {
      return requestJson<GroupPost>(
        `/groups/${groupId}/posts`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        { baseUrl },
      );
    },
    reportGroupPost(_groupId: string, postId: string, reason?: string) {
      return requestJson<ModerationActionResult>(
        buildDiscussionPostReportRoute(postId),
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        },
      );
    },
    hideGroupPost(_groupId: string, postId: string, reason?: string) {
      return requestJson<GroupPost>(
        buildDiscussionPostHideRoute(postId),
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        },
      );
    },
    removeGroupPost(_groupId: string, postId: string) {
      return requestJson<{ id: string }>(
        buildDiscussionPostDetailRoute(postId),
        {
          method: "DELETE",
        },
      ).then((result) => ({
        id: result.id,
        processedAt: new Date().toISOString(),
        status: "removed" as const,
      }));
    },
    flagStudySession(sessionId: string, reason?: string) {
      return requestJson<Record<string, unknown>>(
        buildStudySessionFlagRoute(sessionId),
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        },
      ).then(() => ({
        id: sessionId,
        processedAt: new Date().toISOString(),
        status: "flagged" as const,
      }));
    },
    getExams() {
      return requestJson<Exam[]>("/exams", undefined, { baseUrl });
    },
    createExam(input: CreateExamInput) {
      return requestJson<Exam>(
        "/exams",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        { baseUrl },
      );
    },
    updateExam(examId: string, input: UpdateExamInput) {
      return requestJson<ExamCountdownDto>(
        buildExamCountdownDetailRoute(examId),
        {
          method: "PATCH",
          body: JSON.stringify(mapExamMutationInput(input)),
        },
      ).then(mapExamCountdownToExam);
    },
    deleteExam(examId: string) {
      return requestJson<{ id: string }>(buildExamCountdownDetailRoute(examId), {
        method: "DELETE",
      });
    },
    getProfile() {
      return requestJson<ProfileStats>("/profile", undefined, { baseUrl });
    },
    requestEmailOtp(email: string, nextPath?: string) {
      return requestJson<OtpRequestResult>(
        "/auth/request-otp",
        {
          method: "POST",
          body: JSON.stringify({ email, nextPath }),
        },
        { baseUrl },
      );
    },
  };
}
