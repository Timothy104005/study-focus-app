import type { SupportedStudySubject } from "../product";

export type ISODateString = string;
export type ISODateTimeString = string;
export type TimezoneString = string;

export type AuthUserId = string;
export type ProfileId = string;
export type ClassGroupId = string;
export type GroupMemberId = string;
export type StudySessionId = string;
export type PresenceStatusId = string;
export type ExamCountdownId = string;
export type DiscussionPostId = string;

export type AppLocale = "zh-TW" | "en";
export type TaiwanSchoolStage =
  | "junior_high"
  | "senior_high"
  | "university"
  | "cram_school"
  | "other";

export interface Profile {
  kind: "profile";
  profileId: ProfileId;
  authUserId: AuthUserId;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  schoolName?: string;
  gradeLabel?: string;
  schoolStage: TaiwanSchoolStage;
  locale: AppLocale;
  timezone: TimezoneString;
  defaultGroupId?: ClassGroupId;
  dailyGoalMinutes?: number;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
  lastSeenAt?: ISODateTimeString;
}

export type ClassGroupVisibility = "private" | "school" | "public";

export interface ClassGroup {
  kind: "class_group";
  classGroupId: ClassGroupId;
  slug: string;
  name: string;
  schoolName?: string;
  gradeLabel?: string;
  description?: string;
  ownerProfileId: ProfileId;
  visibility: ClassGroupVisibility;
  inviteCode?: string;
  memberCount: number;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
  archivedAt?: ISODateTimeString;
}

export type GroupMemberRole = "owner" | "admin" | "member";
export type GroupMemberStatus = "active" | "pending" | "left" | "removed";

export interface GroupMember {
  kind: "group_member";
  groupMemberId: GroupMemberId;
  classGroupId: ClassGroupId;
  profileId: ProfileId;
  role: GroupMemberRole;
  status: GroupMemberStatus;
  joinedAt: ISODateTimeString;
  lastReadDiscussionAt?: ISODateTimeString;
}

export type StudySubject = SupportedStudySubject;
export type StudySessionStatus = "active" | "completed" | "cancelled";
export type StudySessionSource = "manual_timer" | "manual_log";
export type StudySessionIntegrity = "clean" | "interrupted" | "discarded";

export interface FocusInterruptionSummary {
  visibilityHiddenCount: number;
  visibilityHiddenSeconds: number;
  windowBlurCount: number;
  manualPauseCount: number;
  lastInterruptedAt?: ISODateTimeString;
}

export interface StudySession {
  kind: "study_session";
  studySessionId: StudySessionId;
  profileId: ProfileId;
  classGroupId?: ClassGroupId;
  subject: StudySubject;
  status: StudySessionStatus;
  source: StudySessionSource;
  startedAt: ISODateTimeString;
  endedAt?: ISODateTimeString;
  elapsedMinutes: number;
  note?: string;
  integrity: StudySessionIntegrity;
  focusInterruptionSummary: FocusInterruptionSummary;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export type PresenceState = "offline" | "online" | "studying" | "on_break";

export interface PresenceStatus {
  kind: "presence_status";
  presenceStatusId: PresenceStatusId;
  profileId: ProfileId;
  classGroupId?: ClassGroupId;
  state: PresenceState;
  activeStudySessionId?: StudySessionId;
  lastHeartbeatAt: ISODateTimeString;
  lastVisibleAt?: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export type ExamCountdownScope = "personal" | "group";

export interface ExamCountdown {
  kind: "exam_countdown";
  examCountdownId: ExamCountdownId;
  ownerProfileId: ProfileId;
  classGroupId?: ClassGroupId;
  scope: ExamCountdownScope;
  title: string;
  examDate: ISODateString;
  timezone: TimezoneString;
  subject?: StudySubject;
  description?: string;
  isPinned: boolean;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export type DiscussionPostStatus = "active" | "deleted";

export interface DiscussionPost {
  kind: "discussion_post";
  discussionPostId: DiscussionPostId;
  classGroupId: ClassGroupId;
  authorProfileId: ProfileId;
  content: string;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
  editedAt?: ISODateTimeString;
  replyToPostId?: DiscussionPostId;
  studySessionId?: StudySessionId;
  status: DiscussionPostStatus;
}

export type LeaderboardWindow = "daily" | "weekly" | "monthly" | "all_time";

export interface LeaderboardEntry {
  kind: "leaderboard_entry";
  profileId: ProfileId;
  classGroupId?: ClassGroupId;
  rank: number;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  window: LeaderboardWindow;
  periodStart: ISODateString;
  periodEnd: ISODateString;
  totalStudyMinutes: number;
  completedSessionCount: number;
  activeDays: number;
  currentStreakDays: number;
  lastSessionEndedAt?: ISODateTimeString;
}
