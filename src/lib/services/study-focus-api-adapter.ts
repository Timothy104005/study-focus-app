import type {
  ClassOption,
  CreateExamInput,
  CreateFocusSessionInput,
  CreateGroupInput,
  CreateGroupPostInput,
  DashboardData,
  Exam,
  FocusOverview,
  FocusSession,
  GroupDetail,
  ModerationActionResult,
  GroupPost,
  GroupSummary,
  LeaderboardData,
  LeaderboardEntry,
  OtpRequestResult,
  ProfileStats,
  SubjectTag,
} from "@/contracts/study-focus";
import type { AuthenticatedRequestContext } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { maskEmail } from "@/lib/format";
import { calculateEffectiveDurationSeconds } from "@/lib/services/mappers";
import {
  createDiscussionPost,
  deleteDiscussionPost,
  hideDiscussionPost,
  listDiscussionPosts,
  reportDiscussionPost,
} from "@/lib/services/discussion-posts";
import { createExamCountdown } from "@/lib/services/exam-countdowns";
import { createGroup, getGroup, getGroupPresenceSnapshot, joinGroupByInviteCode, listGroups } from "@/lib/services/groups";
import { getGroupLeaderboard } from "@/lib/services/leaderboards";
import { ensureCurrentProfile } from "@/lib/services/profiles";
import { flagStudySessionForReview } from "@/lib/services/study-sessions";
import {
  buildAchievementBadges,
  buildAchievementFeedback,
  buildClassHighlights,
  buildGoalProgress,
  buildWeeklyTrend,
  getGoalTargets,
  getGroupActivityHighlight,
  getMilestoneBadgeLabel,
} from "@/lib/study-growth";
import type { Database } from "@/lib/supabase/database.types";

type SessionRow = Database["public"]["Tables"]["study_sessions"]["Row"];
type ExamRow = Database["public"]["Tables"]["exam_countdowns"]["Row"];

const SUBJECT_LABELS_ENGLISH: Record<string, string> = {
  mathematics: "Math",
  english: "English",
  science: "Science",
  social_studies: "Social Studies",
  chinese: "Chinese",
  coding: "Coding",
  other: "Other",
};

const DEFAULT_GROUP_DESCRIPTION = "Study together and keep each other accountable.";
const OTP_DELIVERY_HINT =
  "Check your email. The app can complete sign-in from either a magic link or an OTP code.";

const SUBJECT_LABELS: Record<string, string> = {
  mathematics: "數學",
  english: "英文",
  science: "自然",
  social_studies: "社會",
  chinese: "國文",
  coding: "程式",
  other: "其他",
};

const SUBJECT_TAGS: SubjectTag[] = Object.entries(SUBJECT_LABELS_ENGLISH).map(([id, label]) => ({
  id,
  label,
}));

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateFormatter(timeZone: string) {
  const cached = dateFormatterCache.get(timeZone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  dateFormatterCache.set(timeZone, formatter);
  return formatter;
}

function toDateKey(value: string | Date, timeZone: string) {
  const formatter = getDateFormatter(timeZone);
  const parts = formatter.formatToParts(value instanceof Date ? value : new Date(value));
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function daysAgoDateKey(daysAgo: number, timeZone: string) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return toDateKey(date, timeZone);
}

function getSessionMinutes(session: SessionRow) {
  return Math.max(0, Math.round(calculateEffectiveDurationSeconds(session) / 60));
}

function resolveSubjectId(session: Pick<SessionRow, "title">) {
  return SUBJECT_LABELS_ENGLISH[session.title] ? session.title : "other";
}

function mapSessionToFocusSession(session: SessionRow): FocusSession {
  const subjectId = resolveSubjectId(session);

  return {
    id: session.id,
    subjectId,
    subjectLabel: SUBJECT_LABELS_ENGLISH[subjectId] ?? session.title,
    durationMinutes: getSessionMinutes(session),
    note: session.notes ?? undefined,
    interrupted: session.interruption_count > 0,
    startedAt: session.started_at,
    endedAt: session.ended_at ?? session.updated_at,
  };
}

function mapExamRowToExam(row: ExamRow): Exam {
  return {
    id: row.id,
    title: row.title,
    date: row.exam_at.slice(0, 10),
    type: row.group_id ? "official" : "custom",
    subjectScope: row.subject ?? row.title,
  };
}

async function getCurrentUserSessions(context: AuthenticatedRequestContext) {
  const { data, error } = await context.supabase
    .from("study_sessions")
    .select("*")
    .eq("user_id", context.user.id)
    .order("started_at", { ascending: false });

  if (error) {
    throw new ApiError(500, "session_query_failed", error.message);
  }

  return (data ?? []) as SessionRow[];
}

async function getGroupSessions(context: AuthenticatedRequestContext, groupId: string) {
  const { data, error } = await context.supabase
    .from("study_sessions")
    .select("*")
    .eq("group_id", groupId)
    .order("started_at", { ascending: false });

  if (error) {
    throw new ApiError(500, "group_sessions_failed", error.message);
  }

  return (data ?? []) as SessionRow[];
}

async function getAccessibleExams(context: AuthenticatedRequestContext) {
  const { data, error } = await context.supabase
    .from("exam_countdowns")
    .select("*")
    .order("exam_at", { ascending: true });

  if (error) {
    throw new ApiError(500, "exam_query_failed", error.message);
  }

  return (data ?? []) as ExamRow[];
}

async function getGroupMemberCounts(context: AuthenticatedRequestContext, groupIds: string[]) {
  const counts = new Map<string, number>();

  if (groupIds.length === 0) {
    return counts;
  }

  const { data, error } = await context.supabase.from("group_members").select("group_id").in("group_id", groupIds);

  if (error) {
    throw new ApiError(500, "group_member_count_failed", error.message);
  }

  for (const row of data ?? []) {
    counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1);
  }

  return counts;
}

async function getSessionsForGroupIds(context: AuthenticatedRequestContext, groupIds: string[]) {
  const grouped = new Map<string, SessionRow[]>();

  if (groupIds.length === 0) {
    return grouped;
  }

  const { data, error } = await context.supabase
    .from("study_sessions")
    .select("*")
    .in("group_id", groupIds)
    .order("started_at", { ascending: false });

  if (error) {
    throw new ApiError(500, "group_session_batch_failed", error.message);
  }

  for (const row of (data ?? []) as SessionRow[]) {
    const current = grouped.get(row.group_id) ?? [];
    current.push(row);
    grouped.set(row.group_id, current);
  }

  return grouped;
}

function calculateStreakDays(sessions: SessionRow[], timeZone: string) {
  const activeDays = new Set(
    sessions
      .filter((session) => getSessionMinutes(session) > 0)
      .map((session) => toDateKey(session.started_at, timeZone)),
  );

  let streak = 0;

  for (let offset = 0; offset < 365; offset += 1) {
    const key = daysAgoDateKey(offset, timeZone);

    if (!activeDays.has(key)) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function sumMinutesForSessions(sessions: SessionRow[]) {
  return sessions.reduce((sum, session) => sum + getSessionMinutes(session), 0);
}

function groupSessionsByUser(sessions: SessionRow[]) {
  const grouped = new Map<string, SessionRow[]>();

  for (const session of sessions) {
    const current = grouped.get(session.user_id) ?? [];
    current.push(session);
    grouped.set(session.user_id, current);
  }

  return grouped;
}

function buildUserStatsMap(sessions: SessionRow[], timeZone: string) {
  const grouped = groupSessionsByUser(sessions);
  const todayKey = toDateKey(new Date(), timeZone);
  const currentWeekStartKey = daysAgoDateKey(6, timeZone);
  const userStats = new Map<
    string,
    {
      streakDays: number;
      todayMinutes: number;
      totalMinutes: number;
      weeklyMinutes: number;
    }
  >();

  for (const [userId, userSessions] of grouped.entries()) {
    userStats.set(userId, {
      streakDays: calculateStreakDays(userSessions, timeZone),
      todayMinutes: sumMinutesForSessions(
        userSessions.filter((session) => toDateKey(session.started_at, timeZone) === todayKey),
      ),
      totalMinutes: sumMinutesForSessions(userSessions),
      weeklyMinutes: sumMinutesForSessions(
        getSessionsForDateWindow(userSessions, timeZone, currentWeekStartKey),
      ),
    });
  }

  return userStats;
}

function getDaysUntilDate(value: string) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getNextExamDays(exams: ExamRow[], timeZone: string) {
  const todayKey = toDateKey(new Date(), timeZone);
  const nextExam = exams.find((exam) => toDateKey(exam.exam_at, timeZone) >= todayKey);

  return nextExam ? getDaysUntilDate(nextExam.exam_at) : null;
}

function getSessionsForDateWindow(
  sessions: SessionRow[],
  timeZone: string,
  startKey: string,
  endExclusiveKey?: string,
) {
  return sessions.filter((session) => {
    const dateKey = toDateKey(session.started_at, timeZone);

    if (dateKey < startKey) {
      return false;
    }

    if (endExclusiveKey && dateKey >= endExclusiveKey) {
      return false;
    }

    return true;
  });
}

function getActiveDayCount(sessions: SessionRow[], timeZone: string) {
  return new Set(
    sessions
      .filter((session) => getSessionMinutes(session) > 0)
      .map((session) => toDateKey(session.started_at, timeZone)),
  ).size;
}

function getRecentCleanSessionCount(sessions: SessionRow[]) {
  return sessions
    .filter((session) => getSessionMinutes(session) > 0)
    .slice(0, 3)
    .filter((session) => session.interruption_count === 0).length;
}

function buildUserGrowthMetrics(
  sessions: SessionRow[],
  exams: ExamRow[],
  timeZone: string,
  currentlyStudyingCount = 0,
) {
  const todayKey = toDateKey(new Date(), timeZone);
  const currentWeekStartKey = daysAgoDateKey(6, timeZone);
  const previousWeekStartKey = daysAgoDateKey(13, timeZone);
  const todaySessions = sessions.filter((session) => toDateKey(session.started_at, timeZone) === todayKey);
  const currentWeekSessions = getSessionsForDateWindow(sessions, timeZone, currentWeekStartKey);
  const previousWeekSessions = getSessionsForDateWindow(
    sessions,
    timeZone,
    previousWeekStartKey,
    currentWeekStartKey,
  );
  const todayMinutes = sumMinutesForSessions(todaySessions);
  const currentWeekMinutes = sumMinutesForSessions(currentWeekSessions);
  const previousWeekMinutes = sumMinutesForSessions(previousWeekSessions);
  const recentActiveDays = getActiveDayCount(currentWeekSessions, timeZone);
  const streakDays = calculateStreakDays(sessions, timeZone);
  const totalMinutes = sumMinutesForSessions(sessions);
  const nextExamDays = getNextExamDays(exams, timeZone);
  const goalTargets = getGoalTargets({
    currentWeekMinutes,
    nextExamDays,
    recentActiveDays,
  });
  const dailyGoal = buildGoalProgress("今日目標", todayMinutes, goalTargets.dailyTargetMinutes);
  const weeklyGoal = buildGoalProgress("本週目標", currentWeekMinutes, goalTargets.weeklyTargetMinutes);
  const weeklyTrend = buildWeeklyTrend({
    activeDays: recentActiveDays,
    currentWeekMinutes,
    previousWeekMinutes,
  });
  const badges = buildAchievementBadges({
    cleanSessionCount: getRecentCleanSessionCount(sessions),
    recentActiveDays,
    sessionCount: sessions.filter((session) => getSessionMinutes(session) > 0).length,
    streakDays,
    totalMinutes,
  });
  const achievementFeedback = buildAchievementFeedback({
    currentlyStudyingCount,
    dailyGoal,
    nextExamDays,
    streakDays,
    weeklyTrend,
  });

  return {
    achievementFeedback,
    badges,
    currentWeekMinutes,
    dailyGoal,
    nextExamDays,
    recentActiveDays,
    streakDays,
    todayMinutes,
    totalMinutes,
    weeklyGoal,
    weeklyTrend,
  };
}

function buildGroupActivityData(
  groupName: string,
  memberCount: number,
  liveStudyingCount: number,
  sessions: SessionRow[],
  timeZone: string,
) {
  const todayKey = toDateKey(new Date(), timeZone);
  const currentWeekStartKey = daysAgoDateKey(6, timeZone);
  const activeTodayCount = new Set(
    sessions
      .filter((session) => toDateKey(session.started_at, timeZone) === todayKey)
      .map((session) => session.user_id),
  ).size;
  const weeklySessions = getSessionsForDateWindow(sessions, timeZone, currentWeekStartKey);
  const weeklyTotalMinutes = sumMinutesForSessions(weeklySessions);

  const highlights = buildClassHighlights({
    activeTodayCount,
    groupName,
    liveStudyingCount,
    memberCount,
    weeklyTotalMinutes,
  });

  return {
    activeTodayCount,
    activityHighlight: getGroupActivityHighlight({
      activeTodayCount,
      liveStudyingCount,
      memberCount,
      weeklyTotalMinutes,
    }),
    highlights,
    momentumLabel:
      liveStudyingCount > 0
        ? "現在正有人在讀"
        : activeTodayCount >= Math.max(2, Math.ceil(memberCount / 2))
          ? "今天整組有節奏"
          : weeklyTotalMinutes >= 300
            ? "本週還在穩定累積"
            : "需要有人先開第一輪",
    weeklyTotalMinutes,
  };
}

function mapGroupSummary(
  group: Awaited<ReturnType<typeof listGroups>>[number],
  memberCount: number,
  activityHighlight?: string,
): GroupSummary {
  const summary: GroupSummary = {
    id: group.id,
    name: group.name,
    description: group.description ?? "一起讀書、互相提醒的小組。",
    className: group.name,
    memberCount,
    liveStudyingCount: group.currentlyStudyingCount,
    tags: [group.viewerRole ?? "member", group.currentlyStudyingCount > 0 ? "active" : "quiet"],
    joinCode: group.inviteCode,
    viewerRole: group.viewerRole,
    activityHighlight,
  };

  return {
    ...summary,
    description: group.description ?? DEFAULT_GROUP_DESCRIPTION,
  };
}

function buildLeaderboardEntries(
  entries: Awaited<ReturnType<typeof getGroupLeaderboard>>["entries"],
  groupName: string,
  userStats: Map<
    string,
    {
      streakDays: number;
      todayMinutes: number;
      totalMinutes: number;
      weeklyMinutes: number;
    }
  >,
  currentUserId: string,
): LeaderboardEntry[] {
  return entries.map((entry) => ({
    userId: entry.userId,
    name: entry.displayName,
    className: groupName,
    minutes: entry.totalMinutes,
    streakDays: userStats.get(entry.userId)?.streakDays ?? 0,
    rank: entry.rank,
    trend: entry.rank === 1 ? "up" : entry.rank === 2 ? "same" : "down",
    isCurrentUser: entry.userId === currentUserId,
    badgeLabel: getMilestoneBadgeLabel({
      streakDays: userStats.get(entry.userId)?.streakDays ?? 0,
      todayMinutes: userStats.get(entry.userId)?.todayMinutes ?? 0,
      totalMinutes: userStats.get(entry.userId)?.totalMinutes ?? 0,
      weeklyMinutes: userStats.get(entry.userId)?.weeklyMinutes ?? 0,
    }),
  }));
}

export async function getDashboardData(context: AuthenticatedRequestContext): Promise<DashboardData> {
  const profile = await ensureCurrentProfile(context);
  const [sessions, groups, exams] = await Promise.all([
    getCurrentUserSessions(context),
    listGroups(context),
    getAccessibleExams(context),
  ]);

  const memberCounts = await getGroupMemberCounts(
    context,
    groups.map((group) => group.id),
  );
  const sessionsByGroup = await getSessionsForGroupIds(
    context,
    groups.map((group) => group.id),
  );
  const todayKey = toDateKey(new Date(), profile.timezone);
  const todayMinutes = sumMinutesForSessions(
    sessions.filter((session) => toDateKey(session.started_at, profile.timezone) === todayKey),
  );
  const currentlyStudyingCount = groups.reduce(
    (sum, group) => sum + group.currentlyStudyingCount,
    0,
  );
  const growth = buildUserGrowthMetrics(sessions, exams, profile.timezone, currentlyStudyingCount);
  const nextExam = exams.find((exam) => toDateKey(exam.exam_at, profile.timezone) >= todayKey);
  const firstGroup = groups[0];
  const leaderboardPreview = firstGroup
    ? await (async () => {
        const groupSessions = await getGroupSessions(context, firstGroup.id);
        const userStats = buildUserStatsMap(groupSessions, profile.timezone);

        const leaderboard = await getGroupLeaderboard(context, firstGroup.id, {
          range: "weekly",
          timezone: profile.timezone,
        });

        return buildLeaderboardEntries(
          leaderboard.entries.slice(0, 3),
          firstGroup.name,
          userStats,
          context.user.id,
        );
      })()
    : [];
  const activeGroups = groups.slice(0, 3).map((group) => {
    const activity = buildGroupActivityData(
      group.name,
      memberCounts.get(group.id) ?? 0,
      group.currentlyStudyingCount,
      sessionsByGroup.get(group.id) ?? [],
      profile.timezone,
    );

    return {
      highlights: activity.highlights,
      summary: mapGroupSummary(group, memberCounts.get(group.id) ?? 0, activity.activityHighlight),
    };
  });

  return {
    todayMinutes,
    streakDays: growth.streakDays,
    dailyGoal: growth.dailyGoal,
    weeklyGoal: growth.weeklyGoal,
    weeklyTrend: growth.weeklyTrend,
    achievementFeedback: growth.achievementFeedback,
    nextExam: nextExam ? mapExamRowToExam(nextExam) : undefined,
    leaderboardPreview,
    activeGroups: activeGroups.map((group) => group.summary),
    classHighlights: activeGroups.flatMap((group) => group.highlights).slice(0, 3),
    currentlyStudyingCount,
  };
}

export async function getFocusOverviewData(context: AuthenticatedRequestContext): Promise<FocusOverview> {
  const profile = await ensureCurrentProfile(context);
  const [sessions, groups, exams] = await Promise.all([
    getCurrentUserSessions(context),
    listGroups(context),
    getAccessibleExams(context),
  ]);
  const todayKey = toDateKey(new Date(), profile.timezone);
  const todaySessions = sessions.filter((session) => toDateKey(session.started_at, profile.timezone) === todayKey);
  const currentlyStudyingCount = groups.reduce(
    (sum, group) => sum + group.currentlyStudyingCount,
    0,
  );
  const growth = buildUserGrowthMetrics(sessions, exams, profile.timezone, currentlyStudyingCount);

  return {
    todayTotalMinutes: sumMinutesForSessions(todaySessions),
    todaySessionCount: todaySessions.length,
    subjects: SUBJECT_TAGS,
    dailyGoal: growth.dailyGoal,
    weeklyGoal: growth.weeklyGoal,
    weeklyTrend: growth.weeklyTrend,
    achievementFeedback: growth.achievementFeedback,
    currentlyStudyingCount,
  };
}

export async function createFocusSessionData(
  context: AuthenticatedRequestContext,
  input: CreateFocusSessionInput,
): Promise<FocusSession> {
  const groups = await listGroups(context);
  const groupId = groups[0]?.id;

  if (!groupId) {
    throw new ApiError(400, "no_group_available", "Create or join a group before logging a focus session.");
  }

  const now = new Date();
  const startedAt = new Date(now.getTime() - input.durationMinutes * 60_000).toISOString();
  const interruptionCount = input.interrupted ? 1 : 0;
  const integrityStatus = interruptionCount > 0 ? "warning" : "clean";

  const { data, error } = await context.supabase
    .from("study_sessions")
    .insert({
      user_id: context.user.id,
      group_id: groupId,
      title: input.subjectId,
      notes: input.note ?? null,
      status: "stopped",
      started_at: startedAt,
      ended_at: now.toISOString(),
      accumulated_focus_seconds: input.durationMinutes * 60,
      effective_duration_seconds: input.durationMinutes * 60,
      interruption_count: interruptionCount,
      integrity_status: integrityStatus,
      last_interruption_at: input.interrupted ? now.toISOString() : null,
      last_interruption_reason: input.interrupted ? "manual" : null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new ApiError(400, "focus_session_create_failed", error?.message ?? "Unable to save focus session.");
  }

  return mapSessionToFocusSession(data as SessionRow);
}

export async function getLeaderboardData(
  context: AuthenticatedRequestContext,
  selectedGroupId?: string,
): Promise<LeaderboardData> {
  const profile = await ensureCurrentProfile(context);
  const [groups, sessions, exams] = await Promise.all([
    listGroups(context),
    getCurrentUserSessions(context),
    getAccessibleExams(context),
  ]);

  if (groups.length === 0) {
    const growth = buildUserGrowthMetrics(sessions, exams, profile.timezone, 0);

    return {
      classOptions: [],
      selectedClassId: "",
      daily: [],
      weekly: [],
      dailyGoal: growth.dailyGoal,
      weeklyGoal: growth.weeklyGoal,
      weeklyTrend: growth.weeklyTrend,
      currentlyStudyingCount: 0,
      classHighlights: [],
      updatedAt: new Date().toISOString(),
    };
  }

  const memberCounts = await getGroupMemberCounts(
    context,
    groups.map((group) => group.id),
  );
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0];
  const groupSessions = await getGroupSessions(context, selectedGroup.id);
  const userStats = buildUserStatsMap(groupSessions, profile.timezone);
  const growth = buildUserGrowthMetrics(sessions, exams, profile.timezone, selectedGroup.currentlyStudyingCount);
  const groupActivity = buildGroupActivityData(
    selectedGroup.name,
    memberCounts.get(selectedGroup.id) ?? 0,
    selectedGroup.currentlyStudyingCount,
    groupSessions,
    profile.timezone,
  );

  const [daily, weekly] = await Promise.all([
    getGroupLeaderboard(context, selectedGroup.id, {
      range: "daily",
      timezone: profile.timezone,
    }),
    getGroupLeaderboard(context, selectedGroup.id, {
      range: "weekly",
      timezone: profile.timezone,
    }),
  ]);

  const classOptions: ClassOption[] = groups.map((group) => ({
    id: group.id,
    name: group.name,
    memberCount: memberCounts.get(group.id) ?? 0,
  }));

  return {
    classOptions,
    selectedClassId: selectedGroup.id,
    daily: buildLeaderboardEntries(daily.entries, selectedGroup.name, userStats, context.user.id),
    weekly: buildLeaderboardEntries(weekly.entries, selectedGroup.name, userStats, context.user.id),
    dailyGoal: growth.dailyGoal,
    weeklyGoal: growth.weeklyGoal,
    weeklyTrend: growth.weeklyTrend,
    currentlyStudyingCount: selectedGroup.currentlyStudyingCount,
    classHighlights: groupActivity.highlights,
    updatedAt: new Date().toISOString(),
  };
}

export async function getGroupsData(context: AuthenticatedRequestContext): Promise<GroupSummary[]> {
  const profile = await ensureCurrentProfile(context);
  const groups = await listGroups(context);
  const memberCounts = await getGroupMemberCounts(
    context,
    groups.map((group) => group.id),
  );
  const sessionsByGroup = await getSessionsForGroupIds(
    context,
    groups.map((group) => group.id),
  );

  return groups.map((group) => {
    const activity = buildGroupActivityData(
      group.name,
      memberCounts.get(group.id) ?? 0,
      group.currentlyStudyingCount,
      sessionsByGroup.get(group.id) ?? [],
      profile.timezone,
    );

    return mapGroupSummary(group, memberCounts.get(group.id) ?? 0, activity.activityHighlight);
  });
}

export async function createGroupData(context: AuthenticatedRequestContext, input: CreateGroupInput): Promise<GroupSummary> {
  const group = await createGroup(context, {
    name: input.name,
    description: input.description,
  });

  return {
    id: group.id,
    name: group.name,
    description: group.description ?? input.description,
    className: input.className || group.name,
    memberCount: group.members?.length ?? 1,
    liveStudyingCount: group.currentlyStudyingCount,
    tags: [group.viewerRole ?? "owner", "new"],
    joinCode: group.inviteCode,
    viewerRole: group.viewerRole,
    activityHighlight: "剛建立完成，等第一個人開讀就會開始累積節奏。",
  };
}

export async function joinGroupData(context: AuthenticatedRequestContext, joinCode: string): Promise<GroupSummary> {
  const group = await joinGroupByInviteCode(context, joinCode);

  const summary: GroupSummary = {
    id: group.id,
    name: group.name,
    description: group.description ?? "一起讀書、互相提醒的小組。",
    className: group.name,
    memberCount: group.members?.length ?? 0,
    liveStudyingCount: group.currentlyStudyingCount,
    tags: [group.viewerRole ?? "member", "joined"],
    joinCode: group.inviteCode,
    viewerRole: group.viewerRole,
    activityHighlight: "已加入這組，現在可以直接跟上大家的讀書節奏。",
  };

  return {
    ...summary,
    description: group.description ?? DEFAULT_GROUP_DESCRIPTION,
  };
}

export async function getGroupDetailData(context: AuthenticatedRequestContext, groupId: string): Promise<GroupDetail> {
  const profile = await ensureCurrentProfile(context);
  const [group, presence, posts, groupSessions] = await Promise.all([
    getGroup(context, groupId),
    getGroupPresenceSnapshot(context, groupId),
    listDiscussionPosts(context, groupId),
    getGroupSessions(context, groupId),
  ]);

  const sessionsByUser = groupSessionsByUser(groupSessions);
  const todayKey = toDateKey(new Date(), profile.timezone);
  const weeklyCutoffKey = daysAgoDateKey(6, profile.timezone);

  const members =
    group.members?.map((member) => {
      const memberSessions = sessionsByUser.get(member.userId) ?? [];
      const todayMinutes = sumMinutesForSessions(
        memberSessions.filter((session) => toDateKey(session.started_at, profile.timezone) === todayKey),
      );
      const presenceMember = presence.members.find((item) => item.userId === member.userId);

      return {
        id: member.userId,
        name: member.profile.displayName,
        studyingNow: presenceMember?.status === "studying",
        todayMinutes,
        streakDays: calculateStreakDays(memberSessions, profile.timezone),
        milestoneBadge: getMilestoneBadgeLabel({
          streakDays: calculateStreakDays(memberSessions, profile.timezone),
          todayMinutes,
          totalMinutes: sumMinutesForSessions(memberSessions),
          weeklyMinutes: sumMinutesForSessions(
            memberSessions.filter((session) => toDateKey(session.started_at, profile.timezone) >= weeklyCutoffKey),
          ),
        }),
        activeSessionId: presenceMember?.activeSessionId ?? null,
        activeSessionIntegrityStatus:
          presenceMember?.activeSessionId
            ? (memberSessions.find((session) => session.id === presenceMember.activeSessionId)?.integrity_status ?? null)
            : null,
      };
    }) ?? [];

  const todayTotalMinutes = sumMinutesForSessions(
    groupSessions.filter((session) => toDateKey(session.started_at, profile.timezone) === todayKey),
  );
  const weeklyTotalMinutes = sumMinutesForSessions(
    groupSessions.filter((session) => toDateKey(session.started_at, profile.timezone) >= weeklyCutoffKey),
  );
  const activeTodayCount = members.filter((member) => member.todayMinutes > 0).length;
  const topMember = [...members].sort((left, right) => right.streakDays - left.streakDays)[0];
  const highlights = buildClassHighlights({
    activeTodayCount,
    groupName: group.name,
    liveStudyingCount: presence.currentlyStudyingCount,
    memberCount: members.length,
    topPerformerName: topMember?.name,
    topStreakDays: topMember?.streakDays ?? 0,
    weeklyTotalMinutes,
  });
  const activityHighlight = getGroupActivityHighlight({
    activeTodayCount,
    liveStudyingCount: presence.currentlyStudyingCount,
    memberCount: members.length,
    weeklyTotalMinutes,
  });

  return {
    group: {
      id: group.id,
      name: group.name,
      description: group.description ?? "一起讀書、互相提醒的小組。",
      className: group.name,
      memberCount: members.length,
      liveStudyingCount: presence.currentlyStudyingCount,
      tags: [group.viewerRole ?? "member", presence.currentlyStudyingCount > 0 ? "active" : "quiet"],
      joinCode: group.inviteCode,
      viewerRole: group.viewerRole,
      activityHighlight,
    },
    members,
    posts: [...posts]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map<GroupPost>((post) => ({
        id: post.id,
        authorId: post.author.id,
        authorName: post.author.displayName,
        createdAt: post.createdAt,
        content: post.content,
        status: post.status,
      })),
    stats: {
      totalMembers: members.length,
      liveStudyingCount: presence.currentlyStudyingCount,
      todayTotalMinutes,
      weeklyTotalMinutes,
      averageMinutesPerMember: members.length === 0 ? 0 : Math.round(weeklyTotalMinutes / members.length),
      activeTodayCount,
      momentumLabel:
        presence.currentlyStudyingCount > 0
          ? "現在正有人在讀"
          : activeTodayCount >= Math.max(2, Math.ceil(members.length / 2))
            ? "今天整組都有碰書"
            : weeklyTotalMinutes >= 300
              ? "本週有穩定累積"
              : "等第一個人把節奏帶起來",
    },
    highlights,
  };
}

export async function createGroupPostData(
  context: AuthenticatedRequestContext,
  groupId: string,
  input: CreateGroupPostInput,
): Promise<GroupPost> {
  const post = await createDiscussionPost(context, {
    groupId,
    content: input.content,
  });

  return {
    id: post.id,
    authorId: post.author.id,
    authorName: post.author.displayName,
    createdAt: post.createdAt,
    content: post.content,
    status: post.status,
  };
}

export async function reportGroupPostData(
  context: AuthenticatedRequestContext,
  postId: string,
  reason?: string,
): Promise<ModerationActionResult> {
  const result = await reportDiscussionPost(context, postId, reason);

  return {
    id: result.id,
    processedAt: result.processedAt,
    status: result.status,
  };
}

export async function hideGroupPostData(
  context: AuthenticatedRequestContext,
  postId: string,
  reason?: string,
): Promise<GroupPost> {
  const post = await hideDiscussionPost(context, postId, reason);

  return {
    id: post.id,
    authorId: post.author.id,
    authorName: post.author.displayName,
    createdAt: post.createdAt,
    content: post.content,
    status: post.status,
  };
}

export async function removeGroupPostData(
  context: AuthenticatedRequestContext,
  postId: string,
): Promise<ModerationActionResult> {
  const result = await deleteDiscussionPost(context, postId);

  return {
    id: result.id,
    processedAt: new Date().toISOString(),
    status: "removed",
  };
}

export async function flagStudySessionForReviewData(
  context: AuthenticatedRequestContext,
  sessionId: string,
  reason?: string,
): Promise<ModerationActionResult> {
  await flagStudySessionForReview(context, sessionId, reason);

  return {
    id: sessionId,
    processedAt: new Date().toISOString(),
    status: "flagged",
  };
}

export async function getExamsData(context: AuthenticatedRequestContext): Promise<Exam[]> {
  const exams = await getAccessibleExams(context);
  return exams.map(mapExamRowToExam);
}

export async function createExamData(context: AuthenticatedRequestContext, input: CreateExamInput): Promise<Exam> {
  const countdown = await createExamCountdown(context, {
    title: input.title,
    examAt: new Date(`${input.date}T12:00:00.000Z`).toISOString(),
    groupId: null,
    subject: input.subjectScope,
    notes: null,
  });

  return {
    id: countdown.id,
    title: countdown.title,
    date: countdown.examAt.slice(0, 10),
    type: "custom",
    subjectScope: countdown.subject ?? input.subjectScope,
  };
}

export async function getProfileStatsData(context: AuthenticatedRequestContext): Promise<ProfileStats> {
  const profile = await ensureCurrentProfile(context);
  const [sessions, groups, exams] = await Promise.all([
    getCurrentUserSessions(context),
    listGroups(context),
    getAccessibleExams(context),
  ]);

  const todayKey = toDateKey(new Date(), profile.timezone);
  const weeklyCutoffKey = daysAgoDateKey(6, profile.timezone);
  const todayMinutes = sumMinutesForSessions(
    sessions.filter((session) => toDateKey(session.started_at, profile.timezone) === todayKey),
  );
  const weeklyMinutes = sumMinutesForSessions(
    sessions.filter((session) => toDateKey(session.started_at, profile.timezone) >= weeklyCutoffKey),
  );
  const growth = buildUserGrowthMetrics(sessions, exams, profile.timezone);

  return {
    user: {
      id: profile.id,
      name: profile.displayName,
      className: groups[0]?.name ?? "未加入班級",
      email: profile.email,
    },
    streakDays: growth.streakDays,
    totalStudyMinutes: growth.totalMinutes,
    todayMinutes,
    weeklyMinutes,
    dailyGoal: growth.dailyGoal,
    weeklyGoal: growth.weeklyGoal,
    weeklyTrend: growth.weeklyTrend,
    achievementFeedback: growth.achievementFeedback,
    badges: growth.badges,
    last7Days: Array.from({ length: 7 }, (_, index) => {
      const offset = 6 - index;
      const dateKey = daysAgoDateKey(offset, profile.timezone);
      const minutes = sumMinutesForSessions(
        sessions.filter((session) => toDateKey(session.started_at, profile.timezone) === dateKey),
      );

      return {
        date: dateKey,
        label: dateKey.slice(5).replace("-", "/"),
        minutes,
      };
    }),
    recentSessions: sessions.slice(0, 5).map(mapSessionToFocusSession),
  };
}

export async function requestEmailOtpData(email: string): Promise<OtpRequestResult> {
  const result: OtpRequestResult = {
    maskedEmail: maskEmail(email),
    deliveryHint: "驗證郵件已送出；前端收到 magic link 或 OTP 後即可完成登入。",
    expiresInMinutes: 10,
  };

  return {
    ...result,
    deliveryHint: OTP_DELIVERY_HINT,
  };
}
