"use client";

import Link from "next/link";
import {
  AuthRequiredState,
  EmptyState,
  ErrorState,
  LoadingState,
  NoticeBanner,
} from "@/components/ui/state-panels";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { getButtonClassName } from "@/components/ui/button";
import { useAsyncData } from "@/hooks/use-async-data";
import { calculateCountdownDays, formatDateTime, formatMinutes } from "@/lib/format";
import { getStudyFocusApi } from "@/services/study-focus-api";

const studyFocusApi = getStudyFocusApi();

export function HomePage() {
  const {
    data,
    errorMessage,
    errorStatus,
    isError,
    isLoading,
    reload,
  } = useAsyncData(() => studyFocusApi.getDashboard(), []);

  if (isLoading) {
    return (
      <div className="page">
        <LoadingState label="正在整理你的今日專注與班級動態。" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page">
        {errorStatus === 401 ? (
          <AuthRequiredState description="登入後才能看到首頁摘要、排行榜與小組動態。" />
        ) : (
          <ErrorState description={errorMessage ?? "首頁資料載入失敗。"} onRetry={reload} />
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
        <EmptyState
          title="還沒有首頁摘要"
          description="完成第一場專注後，這裡就會開始整理你的今日進度。"
        />
      </div>
    );
  }

  const currentUserRank = data.leaderboardPreview.find(
    (entry) => entry.isCurrentUser,
  )?.rank;
  const nextExamDays = data.nextExam
    ? calculateCountdownDays(data.nextExam.date)
    : null;
  const leadingHighlight = data.classHighlights[0];

  return (
    <div className="page stack-lg dashboard-page">
      <PageHeader
        eyebrow="今日總覽"
        title="今天先讀穩，名次就會慢慢往前。"
        description="用最少的干擾掌握專注時數、班級節奏、小組狀態和最近的考試壓力。"
      />

      <section className="dashboard-goal-card">
        <div className="stack-xs">
          <h2 className="section-title">今天的目標</h2>
          <p className="meta-text">先完成今天該讀的分鐘數，再看延伸練習。</p>
        </div>
        <p className="dashboard-goal-card__minutes">{formatMinutes(data.todayMinutes)}</p>
      </section>

      <NoticeBanner tone={data.achievementFeedback.tone}>
        <strong>{data.achievementFeedback.title}</strong> {data.achievementFeedback.message}
      </NoticeBanner>

      <hr className="page-divider" />

      <section className="hero-card home-hero">
        <div className="stack-md">
          <div className="hero-meta">
            <span className="hero-badge">今日 {formatMinutes(data.todayMinutes)}</span>
            <span className="hero-badge">連續 {data.streakDays} 天</span>
            <span className="hero-badge">{data.dailyGoal.statusText}</span>
            {currentUserRank ? (
              <span className="hero-badge">班排第 {currentUserRank} 名</span>
            ) : null}
            {data.currentlyStudyingCount > 0 ? (
              <span className="hero-badge">{data.currentlyStudyingCount} 人正在讀</span>
            ) : null}
          </div>

          <div className="stack-sm">
            <h2 className="home-hero__title">
              把今天該讀的先完成，穩定比爆衝更有用。
            </h2>
            <p className="page-description">
              進入專注頁開始計時，或直接去看排行榜和小組動態，讓節奏接上。
            </p>
          </div>
        </div>

        <div className="button-row">
          <Link href="/focus" className={getButtonClassName("primary")}>
            開始專注
          </Link>
          <Link href="/leaderboard" className={getButtonClassName("secondary")}>
            查看排行榜
          </Link>
        </div>
      </section>

      <hr className="page-divider" />

      <div className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">今日累積</span>
          <p className="stat-value">{formatMinutes(data.todayMinutes)}</p>
          <span className="meta-text">每一段穩定專注都會算進來</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">今日目標</span>
          <p className="stat-value">
            {formatMinutes(data.dailyGoal.currentMinutes)} / {formatMinutes(data.dailyGoal.targetMinutes)}
          </p>
          <span className="meta-text">{data.dailyGoal.statusText}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">本週趨勢</span>
          <p className="stat-value">
            {data.weeklyTrend.direction === "up"
              ? "向上"
              : data.weeklyTrend.direction === "down"
                ? "補節奏中"
                : "持平"}
          </p>
          <span className="meta-text">{data.weeklyTrend.summary}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">下一場考試</span>
          <p className="stat-value">
            {nextExamDays === null ? "未設定" : `${nextExamDays} 天`}
          </p>
          <span className="meta-text">
            {data.nextExam?.title ?? `現在有 ${data.currentlyStudyingCount} 人正在讀`}
          </span>
        </article>
      </div>

      <hr className="page-divider" />

      <div className="dashboard-hero">
        <SectionCard
          title="排行榜前段"
          description="先看班上目前最穩的人，也順手確認你自己的位置。"
          action={
            <Link href="/leaderboard" className="text-link">
              查看完整排行榜
            </Link>
          }
        >
          {data.leaderboardPreview.length === 0 ? (
            <EmptyState
              title="還沒有排行榜資料"
              description="只要班上開始出現讀書紀錄，這裡就會更新。"
            />
          ) : (
            <div className="leaderboard-list">
              {data.leaderboardPreview.map((entry) => (
                <article
                  key={entry.userId}
                  className={
                    entry.isCurrentUser
                      ? "top-rank-card top-rank-card--current"
                      : "top-rank-card"
                  }
                >
                  <div className="top-rank-row">
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
                          {formatMinutes(entry.minutes)} · 連續 {entry.streakDays} 天
                          {entry.badgeLabel ? ` · ${entry.badgeLabel}` : ""}
                        </span>
                      </div>
                    </div>
                    <span className="trend-pill">
                      {entry.trend === "up"
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

        <SectionCard
          title="班級動態"
          description="先看眾人的節奏在哪裡，再決定自己現在要不要立刻開讀。"
          action={
            <Link href="/groups" className="text-link">
              前往小組
            </Link>
          }
        >
          {data.activeGroups.length === 0 ? (
            <EmptyState
              title="還沒有活躍小組"
              description="先建立或加入小組，首頁就會開始顯示同步讀書的人數。"
            />
          ) : (
            <div className="stack-md">
              {leadingHighlight ? (
                <div className="state-card state-card--stack">
                  <div className="stack-xs">
                    <h3 className="state-title">{leadingHighlight.title}</h3>
                    <p className="state-description">{leadingHighlight.description}</p>
                  </div>
                </div>
              ) : null}

              <div className="group-list">
                {data.activeGroups.map((group) => (
                  <Link key={group.id} href={`/groups/${group.id}`} className="group-card">
                    <div className="stack-xs">
                      <strong>{group.name}</strong>
                      <p className="section-description">{group.description}</p>
                      {group.activityHighlight ? (
                        <p className="meta-text">{group.activityHighlight}</p>
                      ) : null}
                    </div>
                    <div className="group-card__footer">
                      <span>{group.className}</span>
                      <strong>{group.liveStudyingCount} 人在線</strong>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          <p className="meta-text">
            最後同步時間：{formatDateTime(new Date().toISOString())}
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
