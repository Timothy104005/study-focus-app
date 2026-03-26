"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getButtonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import {
  AuthRequiredState,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/state-panels";
import { useAsyncData } from "@/hooks/use-async-data";
import { formatDateTime, formatMinutes } from "@/lib/format";
import { getStudyFocusApi } from "@/services/study-focus-api";

const studyFocusApi = getStudyFocusApi();

export function LeaderboardPage() {
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>();
  const [range, setRange] = useState<"daily" | "weekly">("daily");
  const {
    data,
    errorMessage,
    errorStatus,
    isError,
    isLoading,
    reload,
  } = useAsyncData(
    () => studyFocusApi.getLeaderboard(selectedClassId),
    [selectedClassId],
  );

  const currentUserEntry = useMemo(() => {
    if (!data) {
      return null;
    }

    const ranking = range === "daily" ? data.daily : data.weekly;
    return ranking.find((entry) => entry.isCurrentUser) ?? null;
  }, [data, range]);

  if (isLoading) {
    return (
      <div className="page">
        <LoadingState label="正在更新班級排行榜。" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page">
        {errorStatus === 401 ? (
          <AuthRequiredState description="登入後才能查看你所在小組的日榜與週榜。" />
        ) : (
          <ErrorState description={errorMessage ?? "排行榜載入失敗。"} onRetry={reload} />
        )}
      </div>
    );
  }

  if (!data || data.classOptions.length === 0) {
    return (
      <div className="page">
        <EmptyState
          title="還沒有可查看的排行榜"
          description="先建立或加入讀書小組，排行榜才會開始累積。"
          action={
            <Link href="/groups" className={getButtonClassName("primary")}>
              前往小組
            </Link>
          }
        />
      </div>
    );
  }

  const ranking = range === "daily" ? data.daily : data.weekly;
  const selectValue = selectedClassId ?? data.selectedClassId;

  return (
    <div className="page stack-lg">
      <PageHeader
        eyebrow="班級排行榜"
        title="一起讀，也一起把名次慢慢往前推。"
        description="切換日榜與週榜，快速看懂班上現在誰最穩、你目前在哪個位置。"
      />

      <div className="split-grid split-grid--sidebar">
        <SectionCard
          title="排行榜設定"
          description="先選小組，再切換時間範圍。"
        >
          <div className="field-grid">
            <div className="stack-xs">
              <label className="field-label" htmlFor="leaderboard-class">
                小組 / 班級
              </label>
              <select
                id="leaderboard-class"
                className="select"
                value={selectValue}
                onChange={(event) => setSelectedClassId(event.target.value)}
              >
                {data.classOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} · {option.memberCount} 人
                  </option>
                ))}
              </select>
            </div>

            <div className="stack-xs">
              <span className="field-label">排名區間</span>
              <div className="tab-set">
                <button
                  type="button"
                  className={
                    range === "daily"
                      ? "tab-button tab-button--active"
                      : "tab-button"
                  }
                  onClick={() => setRange("daily")}
                >
                  日榜
                </button>
                <button
                  type="button"
                  className={
                    range === "weekly"
                      ? "tab-button tab-button--active"
                      : "tab-button"
                  }
                  onClick={() => setRange("weekly")}
                >
                  週榜
                </button>
              </div>
            </div>

            <div className="compact-stats">
              <div className="compact-stat">
                <span className="stat-label">目前名次</span>
                <p className="metric-value">
                  {currentUserEntry ? `第 ${currentUserEntry.rank} 名` : "未上榜"}
                </p>
              </div>
              <div className="compact-stat">
                <span className="stat-label">累積時數</span>
                <p className="metric-value">
                  {currentUserEntry ? formatMinutes(currentUserEntry.minutes) : "0 分鐘"}
                </p>
              </div>
              <div className="compact-stat">
                <span className="stat-label">目前在讀</span>
                <p className="metric-value">{data.currentlyStudyingCount} 人</p>
              </div>
              <div className="compact-stat">
                <span className="stat-label">今日目標</span>
                <p className="metric-value">
                  {data.dailyGoal.isComplete ? "已達標" : `${data.dailyGoal.remainingMinutes} 分鐘`}
                </p>
              </div>
            </div>

            <p className="meta-text">{data.weeklyTrend.summary}</p>
            {data.classHighlights.map((highlight) => (
              <p key={highlight.title} className="meta-text">
                {highlight.title} · {highlight.description}
              </p>
            ))}
            <p className="meta-text">
              最後更新：{formatDateTime(data.updatedAt)}
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title={range === "daily" ? "今日排行榜" : "本週排行榜"}
          description="現在的名次會隨完成的專注時數持續更新。"
        >
          {ranking.length === 0 ? (
            <EmptyState
              title="目前還沒有人上榜"
              description="只要小組開始出現專注紀錄，這裡就會更新。"
            />
          ) : (
            <div className="leaderboard-list">
              {ranking.map((entry) => (
                <article
                  key={`${range}-${entry.userId}`}
                  className={
                    entry.isCurrentUser
                      ? "leaderboard-row leaderboard-row--current"
                      : "leaderboard-row"
                  }
                >
                  <div className="leaderboard-row__meta">
                    <span
                      className={
                        entry.rank <= 3
                          ? "leaderboard-rank leaderboard-rank--top"
                          : "leaderboard-rank"
                      }
                    >
                      {entry.rank}
                    </span>

                    <div className="stack-xs">
                      <strong>{entry.name}</strong>
                      <span className="meta-text">
                        {entry.className} · 連續 {entry.streakDays} 天
                        {entry.badgeLabel ? ` · ${entry.badgeLabel}` : ""}
                      </span>
                    </div>
                  </div>

                  <div className="stack-xs session-row__right">
                    <strong>{formatMinutes(entry.minutes)}</strong>
                    <span className="trend-pill">
                      {entry.isCurrentUser
                        ? "你"
                        : entry.trend === "up"
                          ? "上升"
                          : entry.trend === "down"
                            ? "下降"
                            : "持平"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
