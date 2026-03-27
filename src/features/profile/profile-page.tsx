"use client";

import { StudyBarChart } from "@/components/charts/study-bar-chart";
import { RecentSessions } from "@/components/shared/recent-sessions";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import {
  AuthRequiredState,
  EmptyState,
  ErrorState,
  LoadingState,
  NoticeBanner,
} from "@/components/ui/state-panels";
import { useAsyncData } from "@/hooks/use-async-data";
import { formatMinutes } from "@/lib/format";
import { getStudyFocusApi } from "@/services/study-focus-api";

const studyFocusApi = getStudyFocusApi();

export function ProfilePage() {
  const {
    data,
    errorMessage,
    errorStatus,
    isError,
    isLoading,
    reload,
  } = useAsyncData(() => studyFocusApi.getProfile(), []);

  if (isLoading) {
    return (
      <div className="page">
        <LoadingState label="正在整理你的讀書統計。" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page">
        {errorStatus === 401 ? (
          <AuthRequiredState description="登入後才能看到你的連續天數與讀書統計。" />
        ) : (
          <ErrorState description={errorMessage ?? "個人資料載入失敗。"} onRetry={reload} />
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
        <EmptyState
          title="還沒有統計資料"
          description="完成幾次專注後，這裡就會開始整理你的讀書節奏。"
        />
      </div>
    );
  }

  return (
    <div className="page stack-lg">
      <section className="profile-hero">
        <div className="profile-avatar" aria-hidden="true">
          {data.user.name.slice(0, 1)}
        </div>
        <div className="stack-xs">
          <h2 className="section-title">{data.user.name}</h2>
          <p className="meta-text">{data.user.className}</p>
        </div>
        <div className="button-row">
          <Link href="/focus" className="btn btn--primary btn--small">
            開始專注
          </Link>
          <Link href="/leaderboard" className="btn btn--primary btn--small">
            看排行榜
          </Link>
        </div>
      </section>

      <PageHeader
        eyebrow="個人統計"
        title={`${data.user.name} 的讀書節奏`}
        description={`${data.user.className} · ${data.user.email}`}
      />

      <NoticeBanner tone={data.achievementFeedback.tone}>
        <strong>{data.achievementFeedback.title}</strong> {data.achievementFeedback.message}
      </NoticeBanner>

      <div className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">連續天數</span>
          <p className="stat-value">{data.streakDays} 天</p>
          <span className="meta-text">每天都有碰到書，比爆衝更重要</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">今日累積</span>
          <p className="stat-value">{formatMinutes(data.todayMinutes)}</p>
          <span className="meta-text">{data.dailyGoal.statusText}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">本週累積</span>
          <p className="stat-value">{formatMinutes(data.weeklyMinutes)}</p>
          <span className="meta-text">{data.weeklyTrend.summary}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">總讀書時間</span>
          <p className="stat-value">{formatMinutes(data.totalStudyMinutes)}</p>
          <span className="meta-text">每一次專注都會算進你的累積</span>
        </article>
      </div>

      <div className="split-grid split-grid--sidebar">
        <SectionCard
          title="近 7 天趨勢"
          description="不需要每天都衝高，但希望整體慢慢往上。"
        >
          <StudyBarChart points={data.last7Days} />
        </SectionCard>

        <SectionCard
          title="目標進度"
          description="先看今天，再看整週，節奏會更清楚。"
          muted
        >
          <div className="compact-stats">
            <div className="compact-stat">
              <span className="stat-label">今日完成</span>
              <p className="metric-value">
                {formatMinutes(data.dailyGoal.currentMinutes)} / {formatMinutes(data.dailyGoal.targetMinutes)}
              </p>
            </div>
            <div className="compact-stat">
              <span className="stat-label">本週完成</span>
              <p className="metric-value">
                {formatMinutes(data.weeklyGoal.currentMinutes)} / {formatMinutes(data.weeklyGoal.targetMinutes)}
              </p>
            </div>
            <div className="compact-stat">
              <span className="stat-label">本週趨勢</span>
              <p className="metric-value">
                {data.weeklyTrend.direction === "up"
                  ? "向上"
                  : data.weeklyTrend.direction === "down"
                    ? "補節奏中"
                    : "持平"}
              </p>
            </div>
            <div className="compact-stat">
              <span className="stat-label">今天狀態</span>
              <p className="metric-value">{data.dailyGoal.statusText}</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="里程碑"
        description="只保留最輕量的幾個徽章，提醒你現在累積到哪裡。"
      >
        {data.badges.length === 0 ? (
          <EmptyState
            title="還沒有里程碑"
            description="完成幾輪專注後，這裡會開始顯示穩定度與累積進度。"
          />
        ) : (
          <div className="section-grid section-grid--3">
            {data.badges.map((badge) => (
              <article key={badge.id} className="stat-card">
                <span className="stat-label">{badge.label}</span>
                <p className="meta-text">{badge.description}</p>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="最近完成的專注"
        description="回頭看科目與備註，比較容易找到自己最有效的節奏。"
      >
        {data.recentSessions.length === 0 ? (
          <EmptyState
            title="還沒有最近紀錄"
            description="先去完成一輪專注計時，這裡就會開始更新。"
          />
        ) : (
          <RecentSessions sessions={data.recentSessions} />
        )}
      </SectionCard>
    </div>
  );
}
