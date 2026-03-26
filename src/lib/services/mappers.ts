import type {
  ClassGroupDto,
  DiscussionPostDto,
  ExamCountdownDto,
  GroupMemberDto,
  GroupPresenceMemberDto,
  LeaderboardEntryDto,
  ProfileDto,
  StudySessionDto,
} from "@/contracts";
import type { Database } from "@/lib/supabase/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ClassGroupRow = Database["public"]["Tables"]["class_groups"]["Row"];
type GroupMemberRole = Database["public"]["Enums"]["group_member_role"];
type SessionRow = Database["public"]["Tables"]["study_sessions"]["Row"];
type ExamCountdownRow = Database["public"]["Tables"]["exam_countdowns"]["Row"];
const HIDDEN_DISCUSSION_PREFIX = "[Hidden by moderator]";

function fallbackProfile(userId: string): ProfileDto {
  const now = new Date().toISOString();

  return {
    id: userId,
    email: "",
    displayName: "Unknown member",
    avatarUrl: null,
    timezone: "UTC",
    lastSeenAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function mapProfile(row: ProfileRow): ProfileDto {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    timezone: row.timezone,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapGroup(
  row: ClassGroupRow,
  currentlyStudyingCount: number,
  viewerRole?: GroupMemberRole,
): ClassGroupDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    ownerUserId: row.owner_user_id,
    inviteCode: row.invite_code,
    viewerRole,
    currentlyStudyingCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapGroupMember(row: {
  user_id: string;
  role: GroupMemberRole;
  joined_at: string;
  profile: ProfileRow | null;
}): GroupMemberDto {
  return {
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
    profile: row.profile ? mapProfile(row.profile) : fallbackProfile(row.user_id),
  };
}

export function calculateEffectiveDurationSeconds(session: SessionRow) {
  if (session.status === "active" && session.last_resumed_at) {
    const elapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(session.last_resumed_at).getTime()) / 1000),
    );

    return session.accumulated_focus_seconds + elapsedSeconds;
  }

  if (session.status === "paused") {
    return session.accumulated_focus_seconds;
  }

  return session.effective_duration_seconds ?? session.accumulated_focus_seconds;
}

export function mapStudySession(row: SessionRow): StudySessionDto {
  return {
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id,
    title: row.title,
    notes: row.notes,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    lastResumedAt: row.last_resumed_at,
    lastPausedAt: row.last_paused_at,
    accumulatedFocusSeconds: row.accumulated_focus_seconds,
    effectiveDurationSeconds: calculateEffectiveDurationSeconds(row),
    interruptionCount: row.interruption_count,
    integrityStatus: row.integrity_status,
    lastInterruptionAt: row.last_interruption_at,
    lastInterruptionReason: row.last_interruption_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapExamCountdown(row: ExamCountdownRow): ExamCountdownDto {
  return {
    id: row.id,
    userId: row.user_id,
    groupId: row.group_id,
    title: row.title,
    subject: row.subject,
    examAt: row.exam_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDiscussionPost(row: {
  author: Pick<ProfileRow, "id" | "display_name" | "avatar_url"> | null;
  author_user_id: string;
  content: string;
  created_at: string;
  group_id: string;
  id: string;
  updated_at: string;
}): DiscussionPostDto {
  const isHidden = row.content.startsWith(HIDDEN_DISCUSSION_PREFIX);
  const moderationNote = isHidden ? row.content.slice(HIDDEN_DISCUSSION_PREFIX.length).trim() || "This post was hidden." : null;

  return {
    id: row.id,
    groupId: row.group_id,
    authorUserId: row.author_user_id,
    content: isHidden ? moderationNote ?? "This post was hidden." : row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: isHidden ? "hidden" : "active",
    moderationNote,
    author: {
      id: row.author?.id ?? row.author_user_id,
      displayName: row.author?.display_name ?? "Unknown member",
      avatarUrl: row.author?.avatar_url ?? null,
    },
  };
}

export function mapLeaderboardEntry(row: {
  avatar_url: string | null;
  display_name: string;
  integrity_status: Database["public"]["Enums"]["session_integrity_status"];
  interruption_count: number;
  rank: number;
  sessions_completed: number;
  total_seconds: number;
  user_id: string;
}): LeaderboardEntryDto {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    rank: row.rank,
    totalSeconds: row.total_seconds,
    totalMinutes: Math.floor(row.total_seconds / 60),
    sessionsCompleted: row.sessions_completed,
    interruptionCount: row.interruption_count,
    integrityStatus: row.integrity_status,
  };
}

export function mapPresenceMember(row: {
  active_session_id: string | null;
  avatar_url: string | null;
  display_name: string;
  last_seen_at: string | null;
  status: string;
  user_id: string;
}): GroupPresenceMemberDto {
  const normalizedStatus = row.status === "studying" || row.status === "idle" ? row.status : "offline";

  return {
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    lastSeenAt: row.last_seen_at,
    activeSessionId: row.active_session_id,
    status: normalizedStatus,
  };
}
