export type ISODateString = string;
export type ISODateTimeString = string;

// Legacy frontend-shell contract kept for compatibility with /api/* adapter routes.
// New shared backend-facing DTOs and route contracts live under src/contracts/index.ts.
export type LeaderboardRange = "daily" | "weekly";
export type ExamType = "official" | "mock" | "custom";

export interface SubjectTag {
  id: string;
  label: string;
}

export interface FocusSession {
  id: string;
  subjectId: string;
  subjectLabel: string;
  durationMinutes: number;
  note?: string;
  interrupted: boolean;
  startedAt: ISODateTimeString;
  endedAt: ISODateTimeString;
}

export interface GoalProgress {
  label: string;
  targetMinutes: number;
  currentMinutes: number;
  remainingMinutes: number;
  completionRatio: number;
  isComplete: boolean;
  statusText: string;
}

export interface WeeklyTrend {
  totalMinutes: number;
  previousTotalMinutes: number;
  deltaMinutes: number;
  direction: "up" | "same" | "down";
  activeDays: number;
  summary: string;
}

export interface AchievementBadge {
  id: string;
  label: string;
  description: string;
}

export interface AchievementFeedback {
  title: string;
  message: string;
  tone: "info" | "success";
}

export interface ClassActivityHighlight {
  title: string;
  description: string;
}

export interface FocusOverview {
  todayTotalMinutes: number;
  todaySessionCount: number;
  subjects: SubjectTag[];
  dailyGoal: GoalProgress;
  weeklyGoal: GoalProgress;
  weeklyTrend: WeeklyTrend;
  achievementFeedback: AchievementFeedback;
  currentlyStudyingCount: number;
}

export interface CreateFocusSessionInput {
  subjectId: string;
  note?: string;
  durationMinutes: number;
  interrupted: boolean;
}

export interface ClassOption {
  id: string;
  name: string;
  memberCount: number;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  className: string;
  minutes: number;
  streakDays: number;
  rank: number;
  trend: "up" | "same" | "down";
  isCurrentUser: boolean;
  badgeLabel?: string;
}

export interface LeaderboardData {
  classOptions: ClassOption[];
  selectedClassId: string;
  daily: LeaderboardEntry[];
  weekly: LeaderboardEntry[];
  dailyGoal: GoalProgress;
  weeklyGoal: GoalProgress;
  weeklyTrend: WeeklyTrend;
  currentlyStudyingCount: number;
  classHighlights: ClassActivityHighlight[];
  updatedAt: ISODateTimeString;
}

export interface GroupSummary {
  id: string;
  name: string;
  description: string;
  className: string;
  memberCount: number;
  liveStudyingCount: number;
  tags: string[];
  joinCode: string;
  activityHighlight?: string;
  viewerRole?: "owner" | "admin" | "member";
}

export interface GroupMember {
  id: string;
  name: string;
  studyingNow: boolean;
  todayMinutes: number;
  streakDays: number;
  milestoneBadge?: string;
  activeSessionId?: string | null;
  activeSessionIntegrityStatus?: "clean" | "warning" | "flagged" | null;
}

export interface GroupPost {
  id: string;
  authorId: string;
  authorName: string;
  createdAt: ISODateTimeString;
  content: string;
  status: "active" | "hidden";
}

export interface ModerationActionResult {
  id: string;
  status: "reported" | "hidden" | "flagged" | "removed";
  processedAt: ISODateTimeString;
}

export interface GroupStatsSummary {
  totalMembers: number;
  liveStudyingCount: number;
  todayTotalMinutes: number;
  weeklyTotalMinutes: number;
  averageMinutesPerMember: number;
  activeTodayCount: number;
  momentumLabel: string;
}

export interface GroupDetail {
  group: GroupSummary;
  members: GroupMember[];
  posts: GroupPost[];
  stats: GroupStatsSummary;
  highlights: ClassActivityHighlight[];
}

export interface CreateGroupInput {
  name: string;
  description: string;
  className: string;
}

export interface JoinGroupInput {
  joinCode: string;
}

export interface CreateGroupPostInput {
  content: string;
}

export interface Exam {
  id: string;
  title: string;
  date: ISODateString;
  type: ExamType;
  subjectScope: string;
}

export interface CreateExamInput {
  title: string;
  date: ISODateString;
  subjectScope: string;
}

export interface UpdateExamInput {
  title?: string;
  date?: ISODateString;
  subjectScope?: string;
}

export interface DailyStudyPoint {
  date: ISODateString;
  label: string;
  minutes: number;
}

export interface ProfileStats {
  user: {
    id: string;
    name: string;
    className: string;
    email: string;
  };
  streakDays: number;
  totalStudyMinutes: number;
  todayMinutes: number;
  weeklyMinutes: number;
  dailyGoal: GoalProgress;
  weeklyGoal: GoalProgress;
  weeklyTrend: WeeklyTrend;
  achievementFeedback: AchievementFeedback;
  badges: AchievementBadge[];
  last7Days: DailyStudyPoint[];
  recentSessions: FocusSession[];
}

export interface DashboardData {
  todayMinutes: number;
  streakDays: number;
  dailyGoal: GoalProgress;
  weeklyGoal: GoalProgress;
  weeklyTrend: WeeklyTrend;
  achievementFeedback: AchievementFeedback;
  nextExam?: Exam;
  leaderboardPreview: LeaderboardEntry[];
  activeGroups: GroupSummary[];
  classHighlights: ClassActivityHighlight[];
  currentlyStudyingCount: number;
}

export interface OtpRequestResult {
  maskedEmail: string;
  deliveryHint: string;
  expiresInMinutes: number;
}

export interface LegacyStudyFocusApi {
  getDashboard(): Promise<DashboardData>;
  getFocusOverview(): Promise<FocusOverview>;
  createFocusSession(input: CreateFocusSessionInput): Promise<FocusSession>;
  getLeaderboard(classId?: string): Promise<LeaderboardData>;
  getGroups(): Promise<GroupSummary[]>;
  createGroup(input: CreateGroupInput): Promise<GroupSummary>;
  joinGroup(input: JoinGroupInput): Promise<GroupSummary>;
  getGroupDetail(groupId: string): Promise<GroupDetail>;
  createGroupPost(groupId: string, input: CreateGroupPostInput): Promise<GroupPost>;
  reportGroupPost(
    groupId: string,
    postId: string,
    reason?: string,
  ): Promise<ModerationActionResult>;
  hideGroupPost(
    groupId: string,
    postId: string,
    reason?: string,
  ): Promise<GroupPost>;
  removeGroupPost(
    groupId: string,
    postId: string,
  ): Promise<ModerationActionResult>;
  flagStudySession(
    sessionId: string,
    reason?: string,
  ): Promise<ModerationActionResult>;
  getExams(): Promise<Exam[]>;
  createExam(input: CreateExamInput): Promise<Exam>;
  updateExam(examId: string, input: UpdateExamInput): Promise<Exam>;
  deleteExam(examId: string): Promise<{ id: string }>;
  getProfile(): Promise<ProfileStats>;
  requestEmailOtp(email: string, nextPath?: string): Promise<OtpRequestResult>;
}

export type StudyFocusApi = LegacyStudyFocusApi;
