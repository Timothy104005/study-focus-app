import type {
  AchievementBadge,
  AchievementFeedback,
  ClassActivityHighlight,
  GoalProgress,
  WeeklyTrend,
} from "@/contracts/study-focus";
import { formatMinutes } from "@/lib/format";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToNearest15(value: number) {
  return Math.round(value / 15) * 15;
}

export function getGoalTargets(input: {
  currentWeekMinutes: number;
  nextExamDays: number | null;
  recentActiveDays: number;
}) {
  const baselineDaily =
    input.recentActiveDays > 0
      ? roundToNearest15(input.currentWeekMinutes / input.recentActiveDays + 15)
      : 60;
  let dailyTargetMinutes = clamp(baselineDaily || 60, 45, 120);

  if (input.nextExamDays !== null && input.nextExamDays <= 7) {
    dailyTargetMinutes = Math.max(dailyTargetMinutes, 120);
  } else if (input.nextExamDays !== null && input.nextExamDays <= 21) {
    dailyTargetMinutes = Math.max(dailyTargetMinutes, 90);
  } else {
    dailyTargetMinutes = Math.max(dailyTargetMinutes, 60);
  }

  const weeklyTargetMinutes = dailyTargetMinutes * (input.recentActiveDays >= 5 ? 6 : 5);

  return {
    dailyTargetMinutes,
    weeklyTargetMinutes,
  };
}

export function buildGoalProgress(
  label: string,
  currentMinutes: number,
  targetMinutes: number,
): GoalProgress {
  const safeCurrentMinutes = Math.max(0, Math.round(currentMinutes));
  const safeTargetMinutes = Math.max(15, Math.round(targetMinutes));
  const remainingMinutes = Math.max(0, safeTargetMinutes - safeCurrentMinutes);
  const isComplete = safeCurrentMinutes >= safeTargetMinutes;
  const completionRatio = clamp(safeCurrentMinutes / safeTargetMinutes, 0, 1);
  const statusText = isComplete
    ? `${label}已達標`
    : remainingMinutes <= 25
      ? `${label}還差一輪`
      : `${label}還差 ${remainingMinutes} 分鐘`;

  return {
    label,
    targetMinutes: safeTargetMinutes,
    currentMinutes: safeCurrentMinutes,
    remainingMinutes,
    completionRatio,
    isComplete,
    statusText,
  };
}

export function buildWeeklyTrend(input: {
  activeDays: number;
  currentWeekMinutes: number;
  previousWeekMinutes: number;
}): WeeklyTrend {
  const currentWeekMinutes = Math.max(0, Math.round(input.currentWeekMinutes));
  const previousWeekMinutes = Math.max(0, Math.round(input.previousWeekMinutes));
  const deltaMinutes = currentWeekMinutes - previousWeekMinutes;
  const direction =
    deltaMinutes > 20 ? "up" : deltaMinutes < -20 ? "down" : "same";

  const summary =
    direction === "up"
      ? `比上週多 ${formatMinutes(deltaMinutes)}，這週已有 ${input.activeDays} 天有進度。`
      : direction === "down"
        ? `比上週少 ${formatMinutes(Math.abs(deltaMinutes))}，這週先把節奏補回來。`
        : `和上週差不多，這週已有 ${input.activeDays} 天維持節奏。`;

  return {
    totalMinutes: currentWeekMinutes,
    previousTotalMinutes: previousWeekMinutes,
    deltaMinutes,
    direction,
    activeDays: input.activeDays,
    summary,
  };
}

export function buildAchievementBadges(input: {
  cleanSessionCount: number;
  recentActiveDays: number;
  sessionCount: number;
  streakDays: number;
  totalMinutes: number;
}): AchievementBadge[] {
  const badges: AchievementBadge[] = [];

  if (input.sessionCount >= 1) {
    badges.push({
      id: "first-session",
      label: "起步完成",
      description: "已經完成第一輪專注，節奏開始了。",
    });
  }

  if (input.streakDays >= 3) {
    badges.push({
      id: "streak-3",
      label: "連三天",
      description: "連續 3 天都有讀書紀錄。",
    });
  }

  if (input.streakDays >= 7) {
    badges.push({
      id: "streak-7",
      label: "穩定一週",
      description: "連續 7 天維持讀書節奏。",
    });
  }

  if (input.totalMinutes >= 300) {
    badges.push({
      id: "minutes-300",
      label: "5 小時累積",
      description: "總專注時數突破 300 分鐘。",
    });
  }

  if (input.recentActiveDays >= 5) {
    badges.push({
      id: "active-5",
      label: "週節奏穩",
      description: "最近 7 天至少有 5 天有進度。",
    });
  }

  if (input.cleanSessionCount >= 3) {
    badges.push({
      id: "clean-run",
      label: "穩定輸出",
      description: "最近完成的 3 輪都沒有中斷。",
    });
  }

  return badges;
}

export function getMilestoneBadgeLabel(input: {
  streakDays: number;
  todayMinutes: number;
  totalMinutes: number;
  weeklyMinutes: number;
}) {
  if (input.streakDays >= 14) {
    return "14 天穩定";
  }

  if (input.streakDays >= 7) {
    return "7 天連續";
  }

  if (input.totalMinutes >= 600) {
    return "10 小時累積";
  }

  if (input.todayMinutes >= 120) {
    return "今日衝刺";
  }

  if (input.weeklyMinutes >= 300) {
    return "本週穩定";
  }

  return undefined;
}

export function buildAchievementFeedback(input: {
  currentlyStudyingCount?: number;
  dailyGoal: GoalProgress;
  nextExamDays: number | null;
  streakDays: number;
  weeklyTrend: WeeklyTrend;
}): AchievementFeedback {
  if (input.dailyGoal.isComplete) {
    return {
      title: "今天已達標",
      message:
        input.nextExamDays !== null && input.nextExamDays <= 14
          ? "今天的最低門檻已經過了，接下來只要把節奏維持住。"
          : "先把今天守住就很好，晚點想補一輪再補就行。",
      tone: "success",
    };
  }

  if (input.streakDays >= 3 && input.weeklyTrend.direction === "up") {
    return {
      title: "節奏正在往上",
      message: "最近不是靠爆衝，而是靠連續幾天慢慢把量撐起來。",
      tone: "success",
    };
  }

  if ((input.currentlyStudyingCount ?? 0) > 0) {
    return {
      title: "現在有人在讀",
      message: `${input.currentlyStudyingCount} 位同學正在專注，現在跟上最不需要重新暖機。`,
      tone: "info",
    };
  }

  if (input.nextExamDays !== null && input.nextExamDays <= 7) {
    return {
      title: "考前一週",
      message: "先把今天這輪完成，比一直重排計畫更有幫助。",
      tone: "info",
    };
  }

  return {
    title: "今天先完成一輪",
    message: "把最低門檻先做完，後面的進度就會比較容易接上。",
    tone: "info",
  };
}

export function buildClassHighlights(input: {
  activeTodayCount: number;
  groupName: string;
  liveStudyingCount: number;
  memberCount: number;
  topPerformerName?: string;
  topStreakDays?: number;
  weeklyTotalMinutes: number;
}): ClassActivityHighlight[] {
  const highlights: ClassActivityHighlight[] = [];

  if (input.liveStudyingCount > 0) {
    highlights.push({
      title: "現在有人在讀",
      description: `${input.groupName} 現在有 ${input.liveStudyingCount} 位同學正在專注。`,
    });
  }

  if (input.activeTodayCount > 0) {
    highlights.push({
      title: "今天有動起來",
      description: `${input.memberCount} 位成員裡，今天已有 ${input.activeTodayCount} 位有進度。`,
    });
  }

  if (input.weeklyTotalMinutes > 0) {
    highlights.push({
      title: "本週累積",
      description: `${input.groupName} 這週已累積 ${formatMinutes(input.weeklyTotalMinutes)}。`,
    });
  }

  if (input.topPerformerName && (input.topStreakDays ?? 0) >= 3) {
    highlights.push({
      title: "穩定帶節奏",
      description: `${input.topPerformerName} 目前連續 ${input.topStreakDays} 天有讀書紀錄。`,
    });
  }

  return highlights.slice(0, 3);
}

export function getGroupActivityHighlight(input: {
  activeTodayCount: number;
  liveStudyingCount: number;
  memberCount: number;
  weeklyTotalMinutes: number;
}) {
  if (input.liveStudyingCount > 0) {
    return `${input.liveStudyingCount} 人正在讀，現在最容易一起接上節奏。`;
  }

  if (input.activeTodayCount >= Math.max(2, Math.ceil(input.memberCount / 2))) {
    return `今天已有 ${input.activeTodayCount} 人有進度，整組節奏有起來。`;
  }

  if (input.weeklyTotalMinutes >= 300) {
    return `本週已累積 ${formatMinutes(input.weeklyTotalMinutes)}，這組最近很穩。`;
  }

  return "現在還算安靜，適合你先開一輪把節奏帶起來。";
}
