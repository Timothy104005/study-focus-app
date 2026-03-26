import {
  PRODUCT_CONSTANTS,
  mockStudyFocusSnapshot,
  type ClassGroup,
  type DiscussionPost,
  type ExamCountdown,
  type GroupMember,
  type LeaderboardEntry as SharedLeaderboardEntry,
  type Profile,
  type StudySession,
  type StudySubject,
} from "@/contracts/shared";
import type {
  CreateExamInput,
  CreateFocusSessionInput,
  CreateGroupInput,
  DashboardData,
  Exam,
  FocusOverview,
  FocusSession,
  GroupDetail,
  ModerationActionResult,
  GroupPost,
  GroupSummary,
  LegacyStudyFocusApi,
  LeaderboardData,
  LeaderboardEntry,
  ProfileStats,
  SubjectTag,
  UpdateExamInput,
} from "@/contracts/study-focus";
import { calculateCountdownDays, maskEmail } from "@/lib/format";
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

const STORAGE_KEY = "study-focus-ui-overrides";
const DUPLICATE_POST_WINDOW_MS = 2 * 60 * 1000;
const CURRENT_PROFILE_ID =
  mockStudyFocusSnapshot.profiles[0]?.profileId ?? "profile_mock_user";

type Snapshot = {
  profiles: Profile[];
  classGroups: ClassGroup[];
  groupMembers: GroupMember[];
  studySessions: StudySession[];
  examCountdowns: ExamCountdown[];
  discussionPosts: DiscussionPost[];
  leaderboardEntries: SharedLeaderboardEntry[];
  presenceStatuses: typeof mockStudyFocusSnapshot.presenceStatuses;
};

interface LocalOverrides {
  classGroups: ClassGroup[];
  groupMembers: GroupMember[];
  studySessions: StudySession[];
  examCountdowns: ExamCountdown[];
  deletedExamCountdownIds: string[];
  discussionPosts: DiscussionPost[];
}

const EMPTY_OVERRIDES: LocalOverrides = {
  classGroups: [],
  groupMembers: [],
  studySessions: [],
  examCountdowns: [],
  deletedExamCountdownIds: [],
  discussionPosts: [],
};

const subjectLabels: Record<StudySubject, string> = {
  mathematics: "數學",
  english: "英文",
  science: "自然",
  social_studies: "社會",
  chinese: "國文",
  coding: "程式",
  other: "其他",
};

function delay() {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, 220);
  });
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function safeJsonParse<T>(raw: string, fallback: T) {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readOverrides(): LocalOverrides {
  if (typeof window === "undefined") {
    return structuredClone(EMPTY_OVERRIDES);
  }

  const rawStore = window.localStorage.getItem(STORAGE_KEY);

  if (!rawStore) {
    return structuredClone(EMPTY_OVERRIDES);
  }

  return {
    ...structuredClone(EMPTY_OVERRIDES),
    ...safeJsonParse<LocalOverrides>(rawStore, structuredClone(EMPTY_OVERRIDES)),
  };
}

function writeOverrides(overrides: LocalOverrides) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

function updateOverrides(mutator: (draft: LocalOverrides) => void) {
  const nextOverrides = readOverrides();
  mutator(nextOverrides);
  writeOverrides(nextOverrides);
  return nextOverrides;
}

function mergeById<T>(
  seeded: T[],
  overrides: T[],
  getId: (item: T) => string,
) {
  const items = new Map<string, T>();

  for (const item of seeded) {
    items.set(getId(item), item);
  }

  for (const item of overrides) {
    items.set(getId(item), item);
  }

  return [...items.values()];
}

function getSnapshot(): Snapshot {
  const overrides = readOverrides();

  return {
    profiles: [...mockStudyFocusSnapshot.profiles],
    classGroups: mergeById(
      [...mockStudyFocusSnapshot.classGroups],
      overrides.classGroups,
      (item) => item.classGroupId,
    ),
    groupMembers: mergeById(
      [...mockStudyFocusSnapshot.groupMembers],
      overrides.groupMembers,
      (item) => item.groupMemberId,
    ),
    studySessions: mergeById(
      [...mockStudyFocusSnapshot.studySessions],
      overrides.studySessions,
      (item) => item.studySessionId,
    ),
    examCountdowns: mergeById(
      [...mockStudyFocusSnapshot.examCountdowns],
      overrides.examCountdowns,
      (item) => item.examCountdownId,
    ).filter((item) => !overrides.deletedExamCountdownIds.includes(item.examCountdownId)),
    discussionPosts: mergeById(
      [...mockStudyFocusSnapshot.discussionPosts],
      overrides.discussionPosts,
      (item) => item.discussionPostId,
    ),
    leaderboardEntries: [...mockStudyFocusSnapshot.leaderboardEntries],
    presenceStatuses: [...mockStudyFocusSnapshot.presenceStatuses],
  };
}

function getCurrentProfile(snapshot: Snapshot) {
  const profile = snapshot.profiles.find((item) => item.profileId === CURRENT_PROFILE_ID);

  if (!profile) {
    throw new Error("找不到目前登入的測試使用者。");
  }

  return profile;
}

function getProfileById(snapshot: Snapshot, profileId: string) {
  return snapshot.profiles.find((profile) => profile.profileId === profileId);
}

function isActiveMembership(member: GroupMember) {
  return member.status === "active";
}

function getJoinedGroupIds(snapshot: Snapshot, profileId: string) {
  return new Set(
    snapshot.groupMembers
      .filter(
        (member) => member.profileId === profileId && isActiveMembership(member),
      )
      .map((member) => member.classGroupId),
  );
}

function getGroupMembers(snapshot: Snapshot, classGroupId: string) {
  return snapshot.groupMembers.filter(
    (member) => member.classGroupId === classGroupId && isActiveMembership(member),
  );
}

function getViewerRole(snapshot: Snapshot, classGroupId: string, profileId: string) {
  return (
    getGroupMembers(snapshot, classGroupId).find((member) => member.profileId === profileId)?.role
  );
}

function isModeratorRole(role: GroupMember["role"] | undefined) {
  return role === "owner" || role === "admin";
}

function getLiveProfileIds(snapshot: Snapshot, classGroupId: string) {
  const liveProfileIds = new Set<string>();

  for (const session of snapshot.studySessions) {
    if (session.classGroupId === classGroupId && session.status === "active") {
      liveProfileIds.add(session.profileId);
    }
  }

  for (const presence of snapshot.presenceStatuses) {
    if (presence.classGroupId === classGroupId && presence.state === "studying") {
      liveProfileIds.add(presence.profileId);
    }
  }

  return liveProfileIds;
}

function getSessionsForProfile(snapshot: Snapshot, profileId: string) {
  return snapshot.studySessions
    .filter(
      (session) =>
        session.profileId === profileId &&
        session.status !== "cancelled",
    )
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

function getSessionsForGroup(snapshot: Snapshot, classGroupId: string) {
  return snapshot.studySessions.filter(
    (session) =>
      session.classGroupId === classGroupId && session.status !== "cancelled",
  );
}

function getActiveSessionForProfile(
  snapshot: Snapshot,
  classGroupId: string,
  profileId: string,
) {
  return snapshot.studySessions
    .filter(
      (session) =>
        session.classGroupId === classGroupId &&
        session.profileId === profileId &&
        session.status === "active",
    )
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0];
}

function mapSessionIntegrityStatus(
  integrity: StudySession["integrity"],
): "clean" | "warning" | "flagged" {
  if (integrity === "interrupted") {
    return "warning";
  }

  if (integrity === "discarded") {
    return "flagged";
  }

  return "clean";
}

function isHiddenDiscussionPost(post: DiscussionPost) {
  return post.content.startsWith("[Hidden by moderator]");
}

function normalizePostContent(content: string) {
  return content.replace(/\s+/g, " ").trim().toLowerCase();
}

function getTodayMinutesForProfile(snapshot: Snapshot, profileId: string) {
  const today = formatDateKey(new Date());

  return getSessionsForProfile(snapshot, profileId)
    .filter((session) => session.startedAt.slice(0, 10) === today)
    .reduce((sum, session) => sum + session.elapsedMinutes, 0);
}

function getWeeklyMinutesForProfile(snapshot: Snapshot, profileId: string) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 6);
  const cutoffKey = formatDateKey(cutoff);

  return getSessionsForProfile(snapshot, profileId)
    .filter((session) => session.startedAt.slice(0, 10) >= cutoffKey)
    .reduce((sum, session) => sum + session.elapsedMinutes, 0);
}

function getDailyPoints(snapshot: Snapshot, profileId: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const dateKey = formatDateKey(date);

    return {
      date: dateKey,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      minutes: getSessionsForProfile(snapshot, profileId)
        .filter((session) => session.startedAt.slice(0, 10) === dateKey)
        .reduce((sum, session) => sum + session.elapsedMinutes, 0),
    };
  });
}

function getCurrentStreak(snapshot: Snapshot, profileId: string) {
  const activeDays = new Set(
    getSessionsForProfile(snapshot, profileId).map((session) => session.startedAt.slice(0, 10)),
  );
  const cursor = new Date();
  let streak = 0;

  while (activeDays.has(formatDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getPreviousWeekMinutesForProfile(snapshot: Snapshot, profileId: string) {
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - 13);
  const currentWeekStart = new Date();
  currentWeekStart.setDate(currentWeekStart.getDate() - 6);
  const rangeStartKey = formatDateKey(rangeStart);
  const currentWeekStartKey = formatDateKey(currentWeekStart);

  return getSessionsForProfile(snapshot, profileId)
    .filter(
      (session) =>
        session.startedAt.slice(0, 10) >= rangeStartKey &&
        session.startedAt.slice(0, 10) < currentWeekStartKey,
    )
    .reduce((sum, session) => sum + session.elapsedMinutes, 0);
}

function getRecentActiveDaysForProfile(snapshot: Snapshot, profileId: string) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 6);
  const cutoffKey = formatDateKey(cutoff);

  return new Set(
    getSessionsForProfile(snapshot, profileId)
      .filter((session) => session.startedAt.slice(0, 10) >= cutoffKey)
      .map((session) => session.startedAt.slice(0, 10)),
  ).size;
}

function getRecentCleanSessionCount(snapshot: Snapshot, profileId: string) {
  return getSessionsForProfile(snapshot, profileId)
    .filter((session) => session.elapsedMinutes > 0)
    .slice(0, 3)
    .filter((session) => session.integrity === "clean").length;
}

function getNextExamDaysForProfile(snapshot: Snapshot, profileId: string) {
  const joinedGroupIds = getJoinedGroupIds(snapshot, profileId);
  const nextExam = snapshot.examCountdowns
    .filter(
      (exam) =>
        exam.ownerProfileId === profileId ||
        (exam.classGroupId !== undefined && joinedGroupIds.has(exam.classGroupId)),
    )
    .sort((left, right) => calculateCountdownDays(left.examDate) - calculateCountdownDays(right.examDate))[0];

  return nextExam ? calculateCountdownDays(nextExam.examDate) : null;
}

function buildProfileGrowthState(snapshot: Snapshot, profileId: string, currentlyStudyingCount = 0) {
  const todayMinutes = getTodayMinutesForProfile(snapshot, profileId);
  const weeklyMinutes = getWeeklyMinutesForProfile(snapshot, profileId);
  const previousWeekMinutes = getPreviousWeekMinutesForProfile(snapshot, profileId);
  const streakDays = getCurrentStreak(snapshot, profileId);
  const recentActiveDays = getRecentActiveDaysForProfile(snapshot, profileId);
  const nextExamDays = getNextExamDaysForProfile(snapshot, profileId);
  const goalTargets = getGoalTargets({
    currentWeekMinutes: weeklyMinutes,
    nextExamDays,
    recentActiveDays,
  });
  const dailyGoal = buildGoalProgress("今日目標", todayMinutes, goalTargets.dailyTargetMinutes);
  const weeklyGoal = buildGoalProgress("本週目標", weeklyMinutes, goalTargets.weeklyTargetMinutes);
  const weeklyTrend = buildWeeklyTrend({
    activeDays: recentActiveDays,
    currentWeekMinutes: weeklyMinutes,
    previousWeekMinutes,
  });
  const totalMinutes = getSessionsForProfile(snapshot, profileId).reduce(
    (sum, session) => sum + session.elapsedMinutes,
    0,
  );
  const badges = buildAchievementBadges({
    cleanSessionCount: getRecentCleanSessionCount(snapshot, profileId),
    recentActiveDays,
    sessionCount: getSessionsForProfile(snapshot, profileId).filter((session) => session.elapsedMinutes > 0).length,
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
    dailyGoal,
    streakDays,
    totalMinutes,
    weeklyGoal,
    weeklyMinutes,
    weeklyTrend,
  };
}

function mapSubjectTag(subject: StudySubject): SubjectTag {
  return {
    id: subject,
    label: subjectLabels[subject],
  };
}

function mapFocusSession(session: StudySession): FocusSession {
  return {
    id: session.studySessionId,
    subjectId: session.subject,
    subjectLabel: subjectLabels[session.subject],
    durationMinutes: session.elapsedMinutes,
    note: session.note,
    interrupted: session.integrity === "interrupted",
    startedAt: session.startedAt,
    endedAt: session.endedAt ?? session.updatedAt,
  };
}

function buildGroupClassName(group: ClassGroup) {
  const parts = [group.schoolName, group.gradeLabel].filter(Boolean);
  return parts.join(" ") || group.name;
}

function buildGroupTags(group: ClassGroup) {
  const tags = [group.gradeLabel, group.visibility === "private" ? "班內" : "公開"];
  return tags.filter(Boolean) as string[];
}

function mapGroupSummary(group: ClassGroup, snapshot: Snapshot): GroupSummary {
  const memberCount = getGroupMembers(snapshot, group.classGroupId).length;
  const liveStudyingCount = getLiveProfileIds(snapshot, group.classGroupId).size;
  const sessions = getSessionsForGroup(snapshot, group.classGroupId);
  const viewerRole = getViewerRole(snapshot, group.classGroupId, CURRENT_PROFILE_ID);
  const todayKey = formatDateKey(new Date());
  const weeklyCutoff = new Date();
  weeklyCutoff.setDate(weeklyCutoff.getDate() - 6);
  const cutoffKey = formatDateKey(weeklyCutoff);
  const activeTodayCount = new Set(
    sessions
      .filter((session) => session.startedAt.slice(0, 10) === todayKey)
      .map((session) => session.profileId),
  ).size;
  const weeklyTotalMinutes = sessions
    .filter((session) => session.startedAt.slice(0, 10) >= cutoffKey)
    .reduce((sum, session) => sum + session.elapsedMinutes, 0);

  return {
    id: group.classGroupId,
    name: group.name,
    description: group.description ?? "一起讀書、互相提醒的班級小組。",
    className: buildGroupClassName(group),
    memberCount: memberCount || group.memberCount,
    liveStudyingCount,
    tags: buildGroupTags(group),
    joinCode: group.inviteCode ?? "------",
    viewerRole,
    activityHighlight: getGroupActivityHighlight({
      activeTodayCount,
      liveStudyingCount,
      memberCount: memberCount || group.memberCount,
      weeklyTotalMinutes,
    }),
  };
}

function mapGroupMembersToUi(snapshot: Snapshot, classGroupId: string) {
  const liveProfileIds = getLiveProfileIds(snapshot, classGroupId);
  const weeklyCutoff = new Date();
  weeklyCutoff.setDate(weeklyCutoff.getDate() - 6);
  const cutoffKey = formatDateKey(weeklyCutoff);

  return getGroupMembers(snapshot, classGroupId).map((member) => {
    const profile = getProfileById(snapshot, member.profileId);
    const sessions = getSessionsForProfile(snapshot, member.profileId);
    const activeSession = getActiveSessionForProfile(snapshot, classGroupId, member.profileId);
    const todayMinutes = getTodayMinutesForProfile(snapshot, member.profileId);
    const weeklyMinutes = sessions
      .filter((session) => session.startedAt.slice(0, 10) >= cutoffKey)
      .reduce((sum, session) => sum + session.elapsedMinutes, 0);
    const streakDays = getCurrentStreak(snapshot, member.profileId);

    return {
      id: member.profileId,
      name: profile?.displayName ?? member.profileId,
      studyingNow: liveProfileIds.has(member.profileId),
      todayMinutes,
      streakDays,
      milestoneBadge: getMilestoneBadgeLabel({
        streakDays,
        todayMinutes,
        totalMinutes: sessions.reduce((sum, session) => sum + session.elapsedMinutes, 0),
        weeklyMinutes,
      }),
      activeSessionId: activeSession?.studySessionId ?? null,
      activeSessionIntegrityStatus: activeSession
        ? mapSessionIntegrityStatus(activeSession.integrity)
        : null,
    };
  });
}

function mapDiscussionPostsToUi(snapshot: Snapshot, classGroupId: string): GroupPost[] {
  return snapshot.discussionPosts
    .filter((post) => post.classGroupId === classGroupId && post.status !== "deleted")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((post) => ({
      id: post.discussionPostId,
      authorId: post.authorProfileId,
      authorName: getProfileById(snapshot, post.authorProfileId)?.displayName ?? "匿名成員",
      createdAt: post.createdAt,
      content: post.content,
      status: isHiddenDiscussionPost(post) ? "hidden" : "active",
    }));
}

function mapLeaderboardEntries(
  snapshot: Snapshot,
  classGroupId: string,
  range: "daily" | "weekly",
): LeaderboardEntry[] {
  const members = getGroupMembers(snapshot, classGroupId);

  if (range === "weekly") {
    const seededEntries = snapshot.leaderboardEntries
      .filter(
        (entry) =>
          entry.classGroupId === classGroupId && entry.window === "weekly",
      )
      .sort((left, right) => left.rank - right.rank);

    if (seededEntries.length > 0) {
      return seededEntries.map((entry) => ({
        userId: entry.profileId,
        name: entry.displayName,
        className: buildGroupClassName(
          snapshot.classGroups.find((group) => group.classGroupId === classGroupId) ??
            { kind: "class_group", classGroupId, slug: classGroupId, name: classGroupId, ownerProfileId: "", visibility: "private", memberCount: 0, createdAt: "", updatedAt: "" },
        ),
      minutes: entry.totalStudyMinutes,
      streakDays: entry.currentStreakDays,
      rank: entry.rank,
      trend: entry.rank === 1 ? "up" : entry.rank === 2 ? "same" : "down",
      isCurrentUser: entry.profileId === CURRENT_PROFILE_ID,
      badgeLabel: getMilestoneBadgeLabel({
        streakDays: entry.currentStreakDays,
        todayMinutes: getTodayMinutesForProfile(snapshot, entry.profileId),
        totalMinutes: getSessionsForProfile(snapshot, entry.profileId).reduce(
          (sum, session) => sum + session.elapsedMinutes,
          0,
        ),
        weeklyMinutes: getWeeklyMinutesForProfile(snapshot, entry.profileId),
      }),
    }));
  }
  }

  const totals = members.map((member) => {
    const minutes =
      range === "daily"
        ? getTodayMinutesForProfile(snapshot, member.profileId)
        : getWeeklyMinutesForProfile(snapshot, member.profileId);

    return {
      member,
      minutes,
    };
  });

  return totals
    .sort((left, right) => right.minutes - left.minutes)
    .map(({ member, minutes }, index) => ({
      userId: member.profileId,
      name: getProfileById(snapshot, member.profileId)?.displayName ?? member.profileId,
      className:
        buildGroupClassName(
          snapshot.classGroups.find((group) => group.classGroupId === classGroupId) ??
            { kind: "class_group", classGroupId, slug: classGroupId, name: classGroupId, ownerProfileId: "", visibility: "private", memberCount: 0, createdAt: "", updatedAt: "" },
        ),
      minutes,
      streakDays: getCurrentStreak(snapshot, member.profileId),
      rank: index + 1,
      trend: index === 0 ? "up" : index === 1 ? "same" : "down",
      isCurrentUser: member.profileId === CURRENT_PROFILE_ID,
      badgeLabel: getMilestoneBadgeLabel({
        streakDays: getCurrentStreak(snapshot, member.profileId),
        todayMinutes: getTodayMinutesForProfile(snapshot, member.profileId),
        totalMinutes: getSessionsForProfile(snapshot, member.profileId).reduce(
          (sum, session) => sum + session.elapsedMinutes,
          0,
        ),
        weeklyMinutes: getWeeklyMinutesForProfile(snapshot, member.profileId),
      }),
    }));
}

function mapExamToUi(exam: ExamCountdown, snapshot: Snapshot): Exam {
  const group = exam.classGroupId
    ? snapshot.classGroups.find((item) => item.classGroupId === exam.classGroupId)
    : null;
  const lowerTitle = exam.title.toLowerCase();

  return {
    id: exam.examCountdownId,
    title: exam.title,
    date: exam.examDate,
    type:
      exam.scope === "personal"
        ? "custom"
        : lowerTitle.includes("mock") || exam.title.includes("模擬")
          ? "mock"
          : "official",
    subjectScope:
      exam.subject !== undefined
        ? subjectLabels[exam.subject]
        : group?.name ?? exam.description ?? "未分類",
  };
}

function getEditablePersonalExam(
  snapshot: Snapshot,
  examId: string,
  currentProfileId: string,
) {
  return snapshot.examCountdowns.find(
    (exam) =>
      exam.examCountdownId === examId &&
      exam.ownerProfileId === currentProfileId &&
      exam.scope === "personal",
  );
}

function toSupportedSubject(subjectId: string): StudySubject {
  if (PRODUCT_CONSTANTS.supportedStudySubjects.includes(subjectId as StudySubject)) {
    return subjectId as StudySubject;
  }

  return "other";
}

function buildNewGroup(
  name: string,
  description: string,
  className: string,
  currentProfile: Profile,
): ClassGroup {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const now = new Date().toISOString();

  return {
    kind: "class_group",
    classGroupId: createId("group"),
    slug: slug || createId("group"),
    name,
    schoolName: currentProfile.schoolName,
    gradeLabel: className || currentProfile.gradeLabel,
    description,
    ownerProfileId: currentProfile.profileId,
    visibility: "private",
    inviteCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
    memberCount: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function createMockStudyFocusApi(): LegacyStudyFocusApi {
  return {
    async getDashboard() {
      await delay();
      const snapshot = getSnapshot();
      const currentProfile = getCurrentProfile(snapshot);
      const joinedGroups = snapshot.classGroups
        .filter((group) => getJoinedGroupIds(snapshot, currentProfile.profileId).has(group.classGroupId))
        .map((group) => mapGroupSummary(group, snapshot))
        .sort((left, right) => right.liveStudyingCount - left.liveStudyingCount);
      const currentlyStudyingCount = joinedGroups.reduce(
        (sum, group) => sum + group.liveStudyingCount,
        0,
      );
      const growth = buildProfileGrowthState(
        snapshot,
        currentProfile.profileId,
        currentlyStudyingCount,
      );
      const nextExam = snapshot.examCountdowns
        .filter(
          (exam) =>
            exam.ownerProfileId === currentProfile.profileId ||
            (exam.classGroupId !== undefined &&
              getJoinedGroupIds(snapshot, currentProfile.profileId).has(exam.classGroupId)),
        )
        .sort((left, right) => calculateCountdownDays(left.examDate) - calculateCountdownDays(right.examDate))[0];

      return {
        todayMinutes: getTodayMinutesForProfile(snapshot, currentProfile.profileId),
        streakDays: growth.streakDays,
        dailyGoal: growth.dailyGoal,
        weeklyGoal: growth.weeklyGoal,
        weeklyTrend: growth.weeklyTrend,
        achievementFeedback: growth.achievementFeedback,
        nextExam: nextExam ? mapExamToUi(nextExam, snapshot) : undefined,
        leaderboardPreview: mapLeaderboardEntries(
          snapshot,
          currentProfile.defaultGroupId ?? snapshot.classGroups[0]?.classGroupId ?? "",
          "weekly",
        ).slice(0, 3),
        activeGroups: joinedGroups.slice(0, 3),
        classHighlights: joinedGroups
          .slice(0, 3)
          .filter((group) => group.activityHighlight)
          .map((group) => ({
            title: group.name,
            description: group.activityHighlight ?? "",
          })),
        currentlyStudyingCount,
      };
    },

    async getFocusOverview() {
      await delay();
      const snapshot = getSnapshot();
      const currentProfile = getCurrentProfile(snapshot);
      const joinedGroups = snapshot.classGroups
        .filter((group) => getJoinedGroupIds(snapshot, currentProfile.profileId).has(group.classGroupId))
        .map((group) => mapGroupSummary(group, snapshot));
      const todaySessions = getSessionsForProfile(snapshot, currentProfile.profileId).filter(
        (session) => session.startedAt.slice(0, 10) === formatDateKey(new Date()),
      );
      const growth = buildProfileGrowthState(
        snapshot,
        currentProfile.profileId,
        joinedGroups.reduce((sum, group) => sum + group.liveStudyingCount, 0),
      );

      return {
        todayTotalMinutes: todaySessions.reduce(
          (sum, session) => sum + session.elapsedMinutes,
          0,
        ),
        todaySessionCount: todaySessions.length,
        subjects: PRODUCT_CONSTANTS.supportedStudySubjects.map(mapSubjectTag),
        dailyGoal: growth.dailyGoal,
        weeklyGoal: growth.weeklyGoal,
        weeklyTrend: growth.weeklyTrend,
        achievementFeedback: growth.achievementFeedback,
        currentlyStudyingCount: joinedGroups.reduce(
          (sum, group) => sum + group.liveStudyingCount,
          0,
        ),
      } satisfies FocusOverview;
    },

    async createFocusSession(input: CreateFocusSessionInput) {
      await delay();

      const snapshot = getSnapshot();
      const currentProfile = getCurrentProfile(snapshot);
      const now = new Date();
      const startedAt = new Date(now.getTime() - input.durationMinutes * 60_000).toISOString();
      const newSession: StudySession = {
        kind: "study_session",
        studySessionId: createId("session"),
        profileId: currentProfile.profileId,
        classGroupId: currentProfile.defaultGroupId,
        subject: toSupportedSubject(input.subjectId),
        status: "completed",
        source: "manual_timer",
        startedAt,
        endedAt: now.toISOString(),
        elapsedMinutes: input.durationMinutes,
        note: input.note,
        integrity: input.interrupted ? "interrupted" : "clean",
        focusInterruptionSummary: {
          visibilityHiddenCount: input.interrupted ? 1 : 0,
          visibilityHiddenSeconds: input.interrupted ? 45 : 0,
          windowBlurCount: input.interrupted ? 1 : 0,
          manualPauseCount: 0,
          lastInterruptedAt: input.interrupted ? now.toISOString() : undefined,
        },
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      updateOverrides((draft) => {
        draft.studySessions.unshift(newSession);
      });

      return mapFocusSession(newSession);
    },

    async getLeaderboard(classId) {
      await delay();
      const snapshot = getSnapshot();
      const currentProfile = getCurrentProfile(snapshot);
      const selectedClassId =
        classId ?? currentProfile.defaultGroupId ?? snapshot.classGroups[0]?.classGroupId ?? "";
      const selectedGroup = snapshot.classGroups.find(
        (group) => group.classGroupId === selectedClassId,
      );
      const selectedSummary = selectedGroup
        ? mapGroupSummary(selectedGroup, snapshot)
        : null;
      const growth = buildProfileGrowthState(
        snapshot,
        currentProfile.profileId,
        selectedSummary?.liveStudyingCount ?? 0,
      );

      return {
        classOptions: snapshot.classGroups.map((group) => ({
          id: group.classGroupId,
          name: group.name,
          memberCount: getGroupMembers(snapshot, group.classGroupId).length || group.memberCount,
        })),
        selectedClassId,
        daily: mapLeaderboardEntries(snapshot, selectedClassId, "daily"),
        weekly: mapLeaderboardEntries(snapshot, selectedClassId, "weekly"),
        dailyGoal: growth.dailyGoal,
        weeklyGoal: growth.weeklyGoal,
        weeklyTrend: growth.weeklyTrend,
        currentlyStudyingCount: selectedSummary?.liveStudyingCount ?? 0,
        classHighlights: selectedSummary?.activityHighlight
          ? [
              {
                title: selectedSummary.name,
                description: selectedSummary.activityHighlight,
              },
            ]
          : [],
        updatedAt: new Date().toISOString(),
      } satisfies LeaderboardData;
    },

    async getGroups() {
      await delay();
      const snapshot = getSnapshot();
      const currentProfile = getCurrentProfile(snapshot);
      const joinedGroupIds = getJoinedGroupIds(snapshot, currentProfile.profileId);

      return snapshot.classGroups
        .filter((group) => joinedGroupIds.has(group.classGroupId))
        .map((group) => mapGroupSummary(group, snapshot));
    },

    async createGroup(input: CreateGroupInput) {
      await delay();
      const snapshot = getSnapshot();
      const currentProfile = getCurrentProfile(snapshot);
      const group = buildNewGroup(
        input.name,
        input.description,
        input.className,
        currentProfile,
      );
      const membership: GroupMember = {
        kind: "group_member",
        groupMemberId: createId("member"),
        classGroupId: group.classGroupId,
        profileId: currentProfile.profileId,
        role: "owner",
        status: "active",
        joinedAt: new Date().toISOString(),
      };

      updateOverrides((draft) => {
        draft.classGroups.unshift(group);
        draft.groupMembers.unshift(membership);
      });

      return mapGroupSummary(group, {
        ...snapshot,
        classGroups: [group, ...snapshot.classGroups],
        groupMembers: [membership, ...snapshot.groupMembers],
      });
    },

    async joinGroup({ joinCode }) {
      await delay();
      const snapshot = getSnapshot();
      const currentProfile = getCurrentProfile(snapshot);
      const targetGroup = snapshot.classGroups.find(
        (group) => group.inviteCode?.toLowerCase() === joinCode.toLowerCase(),
      );

      if (!targetGroup) {
        throw new Error("找不到這個邀請碼，請再確認一次。");
      }

      const existingMembership = snapshot.groupMembers.find(
        (member) =>
          member.classGroupId === targetGroup.classGroupId &&
          member.profileId === currentProfile.profileId &&
          isActiveMembership(member),
      );

      if (!existingMembership) {
        updateOverrides((draft) => {
          draft.groupMembers.unshift({
            kind: "group_member",
            groupMemberId: createId("member"),
            classGroupId: targetGroup.classGroupId,
            profileId: currentProfile.profileId,
            role: "member",
            status: "active",
            joinedAt: new Date().toISOString(),
          });
        });
      }

      return mapGroupSummary(targetGroup, getSnapshot());
    },

    async getGroupDetail(groupId: string) {
      await delay();
      const snapshot = getSnapshot();
      const currentProfile = getCurrentProfile(snapshot);
      const joinedGroupIds = getJoinedGroupIds(snapshot, currentProfile.profileId);
      const group = snapshot.classGroups.find((item) => item.classGroupId === groupId);

      if (!group || !joinedGroupIds.has(groupId)) {
        throw new Error("找不到這個群組，或你還沒有加入。");
      }

      const sessions = getSessionsForGroup(snapshot, groupId);
      const todayKey = formatDateKey(new Date());
      const weeklyCutoff = new Date();
      weeklyCutoff.setDate(weeklyCutoff.getDate() - 6);
      const cutoffKey = formatDateKey(weeklyCutoff);
      const members = mapGroupMembersToUi(snapshot, groupId);
      const posts = mapDiscussionPostsToUi(snapshot, groupId);
      const activeTodayCount = members.filter((member) => member.todayMinutes > 0).length;
      const weeklyTotalMinutes = sessions
        .filter((session) => session.startedAt.slice(0, 10) >= cutoffKey)
        .reduce((sum, session) => sum + session.elapsedMinutes, 0);
      const topMember = [...members].sort((left, right) => right.streakDays - left.streakDays)[0];
      const highlights = buildClassHighlights({
        activeTodayCount,
        groupName: group.name,
        liveStudyingCount: members.filter((member) => member.studyingNow).length,
        memberCount: members.length,
        topPerformerName: topMember?.name,
        topStreakDays: topMember?.streakDays ?? 0,
        weeklyTotalMinutes,
      });

      return {
        group: mapGroupSummary(group, snapshot),
        members,
        posts,
        stats: {
          totalMembers: members.length,
          liveStudyingCount: members.filter((member) => member.studyingNow).length,
          todayTotalMinutes: sessions
            .filter((session) => session.startedAt.slice(0, 10) === todayKey)
            .reduce((sum, session) => sum + session.elapsedMinutes, 0),
          weeklyTotalMinutes: sessions
            .filter((session) => session.startedAt.slice(0, 10) >= cutoffKey)
            .reduce((sum, session) => sum + session.elapsedMinutes, 0),
          averageMinutesPerMember:
            members.length === 0
              ? 0
              : Math.round(
                  sessions.reduce((sum, session) => sum + session.elapsedMinutes, 0) /
                    members.length,
                ),
          activeTodayCount,
          momentumLabel:
            members.filter((member) => member.studyingNow).length > 0
              ? "現在正有人在讀"
              : activeTodayCount >= Math.max(2, Math.ceil(members.length / 2))
                ? "今天整組都有碰書"
                : weeklyTotalMinutes >= 300
                  ? "本週有穩定累積"
                  : "等第一個人把節奏帶起來",
        },
        highlights,
      } satisfies GroupDetail;
    },

    async createGroupPost(groupId, input) {
      await delay();
      const snapshot = getSnapshot();
      const currentProfile = getCurrentProfile(snapshot);
      const joinedGroupIds = getJoinedGroupIds(snapshot, currentProfile.profileId);

      if (!joinedGroupIds.has(groupId)) {
        throw new Error("加入群組後才能發文。");
      }

      const duplicatePost = snapshot.discussionPosts.find(
        (post) =>
          post.classGroupId === groupId &&
          post.authorProfileId === currentProfile.profileId &&
          post.status !== "deleted" &&
          normalizePostContent(post.content) === normalizePostContent(input.content) &&
          Date.now() - new Date(post.createdAt).getTime() < DUPLICATE_POST_WINDOW_MS,
      );

      if (duplicatePost) {
        throw new Error("這看起來像重複貼文，請稍後再發送相同內容。");
      }

      const post: DiscussionPost = {
        kind: "discussion_post",
        discussionPostId: createId("post"),
        classGroupId: groupId,
        authorProfileId: currentProfile.profileId,
        content: input.content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "active",
      };

      updateOverrides((draft) => {
        draft.discussionPosts.unshift(post);
      });

      return {
        id: post.discussionPostId,
        authorId: currentProfile.profileId,
        authorName: currentProfile.displayName,
        createdAt: post.createdAt,
        content: post.content,
        status: "active",
      } satisfies GroupPost;
    },

    async reportGroupPost(groupId: string, postId: string, _reason?: string) {
      await delay();
      const snapshot = getSnapshot();
      const currentProfile = getCurrentProfile(snapshot);
      const joinedGroupIds = getJoinedGroupIds(snapshot, currentProfile.profileId);
      const post = snapshot.discussionPosts.find(
        (item) => item.discussionPostId === postId && item.classGroupId === groupId && item.status !== "deleted",
      );

      if (!joinedGroupIds.has(groupId) || !post) {
        throw new Error("只有群組成員才能回報這則貼文。");
      }

      if (post.authorProfileId === currentProfile.profileId) {
        throw new Error("不能回報自己發佈的貼文。");
      }

      return {
        id: postId,
        processedAt: new Date().toISOString(),
        status: "reported",
      } satisfies ModerationActionResult;
    },

    async hideGroupPost(groupId: string, postId: string, reason?: string) {
      await delay();
      const snapshot = getSnapshot();
      const currentProfile = getCurrentProfile(snapshot);
      const viewerRole = getViewerRole(snapshot, groupId, currentProfile.profileId);
      const post = snapshot.discussionPosts.find(
        (item) => item.discussionPostId === postId && item.classGroupId === groupId && item.status !== "deleted",
      );

      if (!isModeratorRole(viewerRole) || !post) {
        throw new Error("只有小組管理員可以隱藏貼文。");
      }

      const nextPost: DiscussionPost = {
        ...post,
        content: reason
          ? `[Hidden by moderator] 已由管理員隱藏。備註：${reason}`
          : "[Hidden by moderator] 已由管理員隱藏。",
        updatedAt: new Date().toISOString(),
      };

      updateOverrides((draft) => {
        draft.discussionPosts.unshift(nextPost);
      });

      return {
        id: nextPost.discussionPostId,
        authorId: nextPost.authorProfileId,
        authorName: getProfileById(snapshot, nextPost.authorProfileId)?.displayName ?? "匿名成員",
        createdAt: nextPost.createdAt,
        content: nextPost.content,
        status: "hidden",
      } satisfies GroupPost;
    },

    async removeGroupPost(groupId: string, postId: string) {
      await delay();
      const snapshot = getSnapshot();
      const currentProfile = getCurrentProfile(snapshot);
      const viewerRole = getViewerRole(snapshot, groupId, currentProfile.profileId);
      const post = snapshot.discussionPosts.find(
        (item) => item.discussionPostId === postId && item.classGroupId === groupId && item.status !== "deleted",
      );

      if (!post) {
        throw new Error("找不到這則貼文。");
      }

      if (post.authorProfileId !== currentProfile.profileId && !isModeratorRole(viewerRole)) {
        throw new Error("只有作者或管理員可以移除貼文。");
      }

      updateOverrides((draft) => {
        draft.discussionPosts.unshift({
          ...post,
          status: "deleted",
          updatedAt: new Date().toISOString(),
        });
      });

      return {
        id: postId,
        processedAt: new Date().toISOString(),
        status: "removed",
      } satisfies ModerationActionResult;
    },

    async flagStudySession(sessionId: string, _reason?: string) {
      await delay();
      const snapshot = getSnapshot();
      const currentProfile = getCurrentProfile(snapshot);
      const session = snapshot.studySessions.find((item) => item.studySessionId === sessionId);

      if (!session) {
        throw new Error("找不到這筆專注紀錄。");
      }

      const viewerRole = session.classGroupId
        ? getViewerRole(snapshot, session.classGroupId, currentProfile.profileId)
        : undefined;

      if (!session.classGroupId || !isModeratorRole(viewerRole)) {
        throw new Error("只有小組管理員可以標記可疑 session。");
      }

      updateOverrides((draft) => {
        draft.studySessions.unshift({
          ...session,
          integrity: "discarded",
          updatedAt: new Date().toISOString(),
        });
      });

      return {
        id: sessionId,
        processedAt: new Date().toISOString(),
        status: "flagged",
      } satisfies ModerationActionResult;
    },

    async getExams() {
      await delay();
      const snapshot = getSnapshot();
      const currentProfile = getCurrentProfile(snapshot);
      const joinedGroupIds = getJoinedGroupIds(snapshot, currentProfile.profileId);

      return snapshot.examCountdowns
        .filter(
          (exam) =>
            exam.ownerProfileId === currentProfile.profileId ||
            (exam.classGroupId !== undefined && joinedGroupIds.has(exam.classGroupId)),
        )
        .map((exam) => mapExamToUi(exam, snapshot));
    },

    async createExam(input: CreateExamInput) {
      await delay();
      const snapshot = getSnapshot();
      const currentProfile = getCurrentProfile(snapshot);
      const now = new Date().toISOString();
      const exam: ExamCountdown = {
        kind: "exam_countdown",
        examCountdownId: createId("exam"),
        ownerProfileId: currentProfile.profileId,
        scope: "personal",
        title: input.title,
        examDate: input.date,
        timezone: currentProfile.timezone,
        description: input.subjectScope,
        isPinned: false,
        createdAt: now,
        updatedAt: now,
      };

      updateOverrides((draft) => {
        draft.examCountdowns.unshift(exam);
      });

      return mapExamToUi(exam, {
        ...snapshot,
        examCountdowns: [exam, ...snapshot.examCountdowns],
      });
    },

    async updateExam(examId: string, input: UpdateExamInput) {
      await delay();
      const snapshot = getSnapshot();
      const currentProfile = getCurrentProfile(snapshot);
      const currentExam = getEditablePersonalExam(
        snapshot,
        examId,
        currentProfile.profileId,
      );

      if (!currentExam) {
        throw new Error("找不到這場自訂考試，或你沒有權限編輯。");
      }

      const nextExam: ExamCountdown = {
        ...currentExam,
        title: input.title?.trim() || currentExam.title,
        examDate: input.date ?? currentExam.examDate,
        description: input.subjectScope?.trim() || currentExam.description,
        updatedAt: new Date().toISOString(),
      };

      updateOverrides((draft) => {
        draft.deletedExamCountdownIds = draft.deletedExamCountdownIds.filter(
          (item) => item !== examId,
        );
        draft.examCountdowns = draft.examCountdowns.filter(
          (item) => item.examCountdownId !== examId,
        );
        draft.examCountdowns.unshift(nextExam);
      });

      return mapExamToUi(nextExam, {
        ...snapshot,
        examCountdowns: [
          nextExam,
          ...snapshot.examCountdowns.filter(
            (item) => item.examCountdownId !== examId,
          ),
        ],
      });
    },

    async deleteExam(examId: string) {
      await delay();
      const snapshot = getSnapshot();
      const currentProfile = getCurrentProfile(snapshot);
      const currentExam = getEditablePersonalExam(
        snapshot,
        examId,
        currentProfile.profileId,
      );

      if (!currentExam) {
        throw new Error("找不到這場自訂考試，或你沒有權限刪除。");
      }

      updateOverrides((draft) => {
        draft.examCountdowns = draft.examCountdowns.filter(
          (item) => item.examCountdownId !== examId,
        );

        if (!draft.deletedExamCountdownIds.includes(examId)) {
          draft.deletedExamCountdownIds.unshift(examId);
        }
      });

      return { id: examId };
    },

    async getProfile() {
      await delay();
      const snapshot = getSnapshot();
      const currentProfile = getCurrentProfile(snapshot);
      const sessions = getSessionsForProfile(snapshot, currentProfile.profileId);
      const joinedGroups = snapshot.classGroups
        .filter((group) => getJoinedGroupIds(snapshot, currentProfile.profileId).has(group.classGroupId))
        .map((group) => mapGroupSummary(group, snapshot));
      const growth = buildProfileGrowthState(
        snapshot,
        currentProfile.profileId,
        joinedGroups.reduce((sum, group) => sum + group.liveStudyingCount, 0),
      );

      return {
        user: {
          id: currentProfile.profileId,
          name: currentProfile.displayName,
          className: buildGroupClassName(
            snapshot.classGroups.find(
              (group) => group.classGroupId === currentProfile.defaultGroupId,
            ) ?? {
              kind: "class_group",
              classGroupId: currentProfile.defaultGroupId ?? "default-group",
              slug: "default-group",
              name: "未加入班級",
              ownerProfileId: currentProfile.profileId,
              visibility: "private",
              memberCount: 0,
              createdAt: currentProfile.createdAt,
              updatedAt: currentProfile.updatedAt,
            },
          ),
          email: `${currentProfile.handle}@student.tw`,
        },
        streakDays: growth.streakDays,
        totalStudyMinutes: growth.totalMinutes,
        todayMinutes: getTodayMinutesForProfile(snapshot, currentProfile.profileId),
        weeklyMinutes: getWeeklyMinutesForProfile(snapshot, currentProfile.profileId),
        dailyGoal: growth.dailyGoal,
        weeklyGoal: growth.weeklyGoal,
        weeklyTrend: growth.weeklyTrend,
        achievementFeedback: growth.achievementFeedback,
        badges: growth.badges,
        last7Days: getDailyPoints(snapshot, currentProfile.profileId),
        recentSessions: sessions.slice(0, 5).map(mapFocusSession),
      } satisfies ProfileStats;
    },

    async requestEmailOtp(email: string, _nextPath?: string) {
      await delay();
      return {
        maskedEmail: maskEmail(email),
        deliveryHint: "目前先提供流程 UI，後端 OTP 驗證完成後就能直接接上。",
        expiresInMinutes: 5,
      };
    },
  };
}
