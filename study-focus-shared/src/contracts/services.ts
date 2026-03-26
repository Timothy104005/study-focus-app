import type {
  ClassGroupDto,
  DiscussionPostDto,
  ExamCountdownDto,
  GroupPresenceSummaryDto,
  InterruptionReason,
  LeaderboardRange,
  LeaderboardResponseDto,
  ModerationActionResultDto,
  ProfileDto,
  StudySessionDto,
} from "./api";
import type {
  ClassGroupId,
  DiscussionPostId,
  ExamCountdownId,
  ISODateTimeString,
  StudySessionId,
  TimezoneString,
} from "./models";

export interface PaginationInput {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<TItem> {
  items: TItem[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface ServiceError {
  code: string;
  message: string;
  field?: string;
  retryable?: boolean;
}

export type ServiceResult<TData> =
  | { ok: true; data: TData }
  | { ok: false; error: ServiceError };

export const STUDY_FOCUS_API_VERSION = "v1" as const;

export const API_ROUTE_PATTERNS = {
  authEmail: "/api/v1/auth/email",
  me: "/api/v1/me",
  mePresence: "/api/v1/me/presence",
  studySessions: "/api/v1/study-sessions",
  studySessionPause: "/api/v1/study-sessions/:studySessionId/pause",
  studySessionResume: "/api/v1/study-sessions/:studySessionId/resume",
  studySessionStop: "/api/v1/study-sessions/:studySessionId/stop",
  studySessionInterrupt: "/api/v1/study-sessions/:studySessionId/interrupt",
  studySessionFlag: "/api/v1/study-sessions/:studySessionId/flag",
  classGroups: "/api/v1/groups",
  classGroupJoin: "/api/v1/groups/join",
  classGroupDetail: "/api/v1/groups/:classGroupId",
  classGroupDiscussionPosts: "/api/v1/groups/:classGroupId/discussion-posts",
  classGroupPresence: "/api/v1/groups/:classGroupId/presence",
  classGroupLeaderboard: "/api/v1/groups/:classGroupId/leaderboard",
  discussionPostDetail: "/api/v1/discussion-posts/:discussionPostId",
  discussionPostReport: "/api/v1/discussion-posts/:discussionPostId/report",
  discussionPostHide: "/api/v1/discussion-posts/:discussionPostId/hide",
  examCountdowns: "/api/v1/exam-countdowns",
  examCountdownDetail: "/api/v1/exam-countdowns/:examCountdownId",
} as const;

export function buildClassGroupDetailRoute(classGroupId: ClassGroupId) {
  return `/api/${STUDY_FOCUS_API_VERSION}/groups/${classGroupId}`;
}

export function buildClassGroupDiscussionPostsRoute(classGroupId: ClassGroupId) {
  return `/api/${STUDY_FOCUS_API_VERSION}/groups/${classGroupId}/discussion-posts`;
}

export function buildClassGroupPresenceRoute(classGroupId: ClassGroupId) {
  return `/api/${STUDY_FOCUS_API_VERSION}/groups/${classGroupId}/presence`;
}

export function buildClassGroupLeaderboardRoute(classGroupId: ClassGroupId) {
  return `/api/${STUDY_FOCUS_API_VERSION}/groups/${classGroupId}/leaderboard`;
}

export function buildStudySessionPauseRoute(studySessionId: StudySessionId) {
  return `/api/${STUDY_FOCUS_API_VERSION}/study-sessions/${studySessionId}/pause`;
}

export function buildStudySessionResumeRoute(studySessionId: StudySessionId) {
  return `/api/${STUDY_FOCUS_API_VERSION}/study-sessions/${studySessionId}/resume`;
}

export function buildStudySessionStopRoute(studySessionId: StudySessionId) {
  return `/api/${STUDY_FOCUS_API_VERSION}/study-sessions/${studySessionId}/stop`;
}

export function buildStudySessionInterruptRoute(studySessionId: StudySessionId) {
  return `/api/${STUDY_FOCUS_API_VERSION}/study-sessions/${studySessionId}/interrupt`;
}

export function buildStudySessionFlagRoute(studySessionId: StudySessionId) {
  return `/api/${STUDY_FOCUS_API_VERSION}/study-sessions/${studySessionId}/flag`;
}

export function buildDiscussionPostDetailRoute(discussionPostId: DiscussionPostId) {
  return `/api/${STUDY_FOCUS_API_VERSION}/discussion-posts/${discussionPostId}`;
}

export function buildDiscussionPostReportRoute(discussionPostId: DiscussionPostId) {
  return `/api/${STUDY_FOCUS_API_VERSION}/discussion-posts/${discussionPostId}/report`;
}

export function buildDiscussionPostHideRoute(discussionPostId: DiscussionPostId) {
  return `/api/${STUDY_FOCUS_API_VERSION}/discussion-posts/${discussionPostId}/hide`;
}

export function buildExamCountdownDetailRoute(examCountdownId: ExamCountdownId) {
  return `/api/${STUDY_FOCUS_API_VERSION}/exam-countdowns/${examCountdownId}`;
}

export type AuthEmailMode = "magic_link" | "otp";

export interface RequestEmailAuthInput {
  email: string;
  mode?: AuthEmailMode;
  nextPath?: string;
}

export interface UpdateCurrentProfileInput {
  displayName?: string;
  avatarUrl?: string | null;
  timezone?: TimezoneString;
}

export interface AuthService {
  requestEmailAuth(
    input: RequestEmailAuthInput
  ): Promise<ServiceResult<{ emailed: true; mode: AuthEmailMode }>>;
}

export interface ProfileService {
  getCurrentProfile(): Promise<ServiceResult<ProfileDto>>;
  updateCurrentProfile(
    input: UpdateCurrentProfileInput
  ): Promise<ServiceResult<ProfileDto>>;
}

export interface CreateStudySessionInput {
  groupId: ClassGroupId;
  title: string;
  notes?: string | null;
}

export interface StudySessionListQuery {
  groupId?: ClassGroupId;
  openOnly?: boolean;
  status?: StudySessionDto["status"];
}

export interface StudySessionService {
  listStudySessions(
    query?: StudySessionListQuery
  ): Promise<ServiceResult<StudySessionDto[]>>;
  createStudySession(
    input: CreateStudySessionInput
  ): Promise<ServiceResult<StudySessionDto>>;
  pauseStudySession(
    studySessionId: StudySessionId
  ): Promise<ServiceResult<StudySessionDto>>;
  resumeStudySession(
    studySessionId: StudySessionId
  ): Promise<ServiceResult<StudySessionDto>>;
  stopStudySession(
    studySessionId: StudySessionId
  ): Promise<ServiceResult<StudySessionDto>>;
  reportStudySessionInterruption(
    studySessionId: StudySessionId,
    reason: InterruptionReason
  ): Promise<ServiceResult<StudySessionDto>>;
  flagStudySessionForReview(
    studySessionId: StudySessionId,
    reason?: string | null
  ): Promise<ServiceResult<StudySessionDto>>;
}

export interface GroupLeaderboardQuery {
  range?: LeaderboardRange;
  timezone?: TimezoneString;
}

export interface LeaderboardService {
  getGroupLeaderboard(
    classGroupId: ClassGroupId,
    query?: GroupLeaderboardQuery
  ): Promise<ServiceResult<LeaderboardResponseDto>>;
}

export interface CreateClassGroupInput {
  name: string;
  description?: string | null;
}

export interface JoinClassGroupInput {
  inviteCode: string;
}

export interface GroupMembershipService {
  listCurrentProfileGroups(): Promise<ServiceResult<ClassGroupDto[]>>;
  createClassGroup(
    input: CreateClassGroupInput
  ): Promise<ServiceResult<ClassGroupDto>>;
  getClassGroup(
    classGroupId: ClassGroupId
  ): Promise<ServiceResult<ClassGroupDto>>;
  joinClassGroup(
    input: JoinClassGroupInput
  ): Promise<ServiceResult<ClassGroupDto>>;
}

export interface CreateExamCountdownInput {
  examAt: ISODateTimeString;
  groupId?: ClassGroupId | null;
  notes?: string | null;
  subject?: string | null;
  title: string;
}

export interface UpdateExamCountdownInput {
  examAt?: ISODateTimeString;
  groupId?: ClassGroupId | null;
  notes?: string | null;
  subject?: string | null;
  title?: string;
}

export interface ExamCountdownListQuery {
  groupId?: ClassGroupId;
}

export interface ExamCountdownService {
  listExamCountdowns(
    query?: ExamCountdownListQuery
  ): Promise<ServiceResult<ExamCountdownDto[]>>;
  createExamCountdown(
    input: CreateExamCountdownInput
  ): Promise<ServiceResult<ExamCountdownDto>>;
  getExamCountdown(
    examCountdownId: ExamCountdownId
  ): Promise<ServiceResult<ExamCountdownDto>>;
  updateExamCountdown(
    examCountdownId: ExamCountdownId,
    input: UpdateExamCountdownInput
  ): Promise<ServiceResult<ExamCountdownDto>>;
  deleteExamCountdown(
    examCountdownId: ExamCountdownId
  ): Promise<ServiceResult<{ id: ExamCountdownId }>>;
}

export interface CreateDiscussionPostInput {
  classGroupId: ClassGroupId;
  content: string;
}

export interface UpdateDiscussionPostInput {
  content: string;
}

export interface DiscussionPostService {
  listDiscussionPosts(
    classGroupId: ClassGroupId
  ): Promise<ServiceResult<DiscussionPostDto[]>>;
  createDiscussionPost(
    input: CreateDiscussionPostInput
  ): Promise<ServiceResult<DiscussionPostDto>>;
  updateDiscussionPost(
    discussionPostId: DiscussionPostId,
    input: UpdateDiscussionPostInput
  ): Promise<ServiceResult<DiscussionPostDto>>;
  reportDiscussionPost(
    discussionPostId: DiscussionPostId,
    reason?: string | null
  ): Promise<ServiceResult<ModerationActionResultDto>>;
  hideDiscussionPost(
    discussionPostId: DiscussionPostId,
    reason?: string | null
  ): Promise<ServiceResult<DiscussionPostDto>>;
  deleteDiscussionPost(
    discussionPostId: DiscussionPostId
  ): Promise<ServiceResult<{ id: DiscussionPostId }>>;
}

// TODO(frontend): migrate remaining legacy pages from src/contracts/study-focus.ts
// to these v1 route contracts and DTOs.
// TODO(backend): add sign-out, explicit membership management, and richer session
// detail routes before expanding these interfaces again.
export interface PresenceTrackingService {
  touchCurrentPresence(): Promise<ServiceResult<ProfileDto>>;
  getGroupPresence(
    classGroupId: ClassGroupId
  ): Promise<ServiceResult<GroupPresenceSummaryDto>>;
}
