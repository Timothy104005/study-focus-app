export type PresenceStatus = "studying" | "idle" | "offline";
export type StudySessionStatus = "active" | "paused" | "stopped";
export type SessionIntegrityStatus = "clean" | "warning" | "flagged";
export type LeaderboardRange = "daily" | "weekly";
export type InterruptionReason = "tab_hidden" | "window_blur" | "manual";
export type GroupMemberRole = "owner" | "admin" | "member";
export type DiscussionPostStatus = "active" | "hidden";
export type ModerationActionStatus = "reported" | "hidden" | "flagged" | "removed";

export interface ProfileDto {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  timezone: string;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMemberDto {
  userId: string;
  role: GroupMemberRole;
  joinedAt: string;
  profile: ProfileDto;
}

export interface ClassGroupDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerUserId: string;
  inviteCode: string;
  viewerRole?: GroupMemberRole;
  currentlyStudyingCount: number;
  createdAt: string;
  updatedAt: string;
  members?: GroupMemberDto[];
  presenceChannel?: string;
}

export interface GroupPresenceMemberDto {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  lastSeenAt: string | null;
  activeSessionId: string | null;
  status: PresenceStatus;
}

export interface GroupPresenceSummaryDto {
  groupId: string;
  channel: string;
  currentlyStudyingCount: number;
  members: GroupPresenceMemberDto[];
  generatedAt: string;
}

export interface StudySessionDto {
  id: string;
  groupId: string;
  userId: string;
  title: string;
  notes: string | null;
  status: StudySessionStatus;
  startedAt: string;
  endedAt: string | null;
  lastResumedAt: string | null;
  lastPausedAt: string | null;
  accumulatedFocusSeconds: number;
  effectiveDurationSeconds: number;
  interruptionCount: number;
  integrityStatus: SessionIntegrityStatus;
  lastInterruptionAt: string | null;
  lastInterruptionReason: InterruptionReason | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeaderboardEntryDto {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  rank: number;
  totalSeconds: number;
  totalMinutes: number;
  sessionsCompleted: number;
  interruptionCount: number;
  integrityStatus: SessionIntegrityStatus;
}

export interface LeaderboardResponseDto {
  groupId: string;
  range: LeaderboardRange;
  timezone: string;
  windowStart: string;
  windowEnd: string;
  currentlyStudyingCount: number;
  entries: LeaderboardEntryDto[];
  generatedAt: string;
}

export interface ExamCountdownDto {
  id: string;
  userId: string;
  groupId: string | null;
  title: string;
  subject: string | null;
  examAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscussionPostDto {
  id: string;
  groupId: string;
  authorUserId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  status: DiscussionPostStatus;
  moderationNote: string | null;
  author: Pick<ProfileDto, "id" | "displayName" | "avatarUrl">;
}

export interface ModerationActionResultDto {
  id: string;
  status: ModerationActionStatus;
  processedAt: string;
  reason: string | null;
}

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
