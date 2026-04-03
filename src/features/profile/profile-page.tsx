"use client";

import { StudyBarChart } from "@/components/charts/study-bar-chart";
import { RecentSessions } from "@/components/shared/recent-sessions";
import Link from "next/link";
import {
  AuthRequiredState,
  EmptyState,
  ErrorState,
  LoadingState,
  NoticeBanner,
} from "@/components/ui/state-panels";
import { useAsyncData } from "@/hooks/use-async-data";
import { formatMinutes } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { getStudyFocusApi } from "@/services/study-focus-api";

const studyFocusApi = getStudyFocusApi();

export function ProfilePage() {
  const { t } = useI18n();
  const { data, errorMessage, errorStatus, isError, isLoading, reload } =
    useAsyncData(() => studyFocusApi.getProfile(), []);

  if (isLoading) {
    return (
      <div className="page">
        <LoadingState label={t("profile_loading")} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page">
        {errorStatus === 401 ? (
          <AuthRequiredState description={t("profile_auth_desc")} />
        ) : (
          <ErrorState description={errorMessage ?? t("profile_loading")} onRetry={reload} />
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
        <EmptyState title={t("profile_empty_title")} description={t("profile_empty_desc")} />
      </div>
    );
  }

  return (
    <div className="page stack-lg">

      {/* Profile hero */}
      <header className="profile-hero" style={{ paddingTop: 52 }}>
        <div className="profile-avatar" aria-hidden="true">
          {data.user.name.slice(0, 1)}
        </div>
        <div className="stack-xs" style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--chalk)" }}>
            {data.user.name}
          </h1>
          <p className="meta-text">{data.user.className}</p>
          <p className="meta-text" style={{ fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
            {data.user.email}
          </p>
        </div>
        <div className="button-row">
          <Link href="/focus" className="btn btn--primary btn--small">{t("profile_cta_focus")}</Link>
          <Link href="/leaderboard" className="btn btn--secondary btn--small">{t("profile_cta_lb")}</Link>
        </div>
      </header>

      {/* Achievement banner */}
      <NoticeBanner tone={data.achievementFeedback.tone}>
        <strong>{data.achievementFeedback.title}</strong> {data.achievementFeedback.message}
      </NoticeBanner>

      {/* Stat grid */}
      <div className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">{t("profile_stat_streak")}</span>
          <p className="stat-value">{data.streakDays}{t("profile_stat_streak_unit")}</p>
          <span className="meta-text">{t("profile_stat_streak_desc")}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">{t("profile_stat_today")}</span>
          <p className="stat-value">{formatMinutes(data.todayMinutes)}</p>
          <span className="meta-text">{data.dailyGoal.statusText}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">{t("profile_stat_weekly")}</span>
          <p className="stat-value">{formatMinutes(data.weeklyMinutes)}</p>
          <span className="meta-text">{data.weeklyTrend.summary}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">{t("profile_stat_total")}</span>
          <p className="stat-value">{formatMinutes(data.totalStudyMinutes)}</p>
          <span className="meta-text">{t("profile_stat_total_desc")}</span>
        </article>
      </div>

      {/* Chart + Goal side by side */}
      <div className="split-grid split-grid--sidebar">
        <section className="card">
          <div className="section-header" style={{ marginBottom: 14 }}>
            <div className="stack-xs">
              <h2 className="section-title">{t("profile_chart_title")}</h2>
              <p className="section-description">{t("profile_chart_desc")}</p>
            </div>
          </div>
          <StudyBarChart points={data.last7Days} />
        </section>

        <section className="card card--muted">
          <div className="section-header" style={{ marginBottom: 14 }}>
            <div className="stack-xs">
              <h2 className="section-title">{t("profile_goal_title")}</h2>
              <p className="section-description">{t("profile_goal_desc")}</p>
            </div>
          </div>
          <div className="compact-stats">
            <div className="compact-stat">
              <span className="stat-label">{t("profile_goal_today")}</span>
              <p className="metric-value">
                {formatMinutes(data.dailyGoal.currentMinutes)} / {formatMinutes(data.dailyGoal.targetMinutes)}
              </p>
            </div>
            <div className="compact-stat">
              <span className="stat-label">{t("profile_goal_weekly")}</span>
              <p className="metric-value">
                {formatMinutes(data.weeklyGoal.currentMinutes)} / {formatMinutes(data.weeklyGoal.targetMinutes)}
              </p>
            </div>
            <div className="compact-stat">
              <span className="stat-label">{t("profile_goal_trend")}</span>
              <p className="metric-value">
                {data.weeklyTrend.direction === "up"
                  ? t("profile_trend_up")
                  : data.weeklyTrend.direction === "down"
                  ? t("profile_trend_down")
                  : t("profile_trend_flat")}
              </p>
            </div>
            <div className="compact-stat">
              <span className="stat-label">{t("profile_goal_status")}</span>
              <p className="metric-value">{data.dailyGoal.statusText}</p>
            </div>
          </div>
        </section>
      </div>

      {/* Badges */}
      <section className="card">
        <div className="section-header" style={{ marginBottom: 14 }}>
          <div className="stack-xs">
            <h2 className="section-title">{t("profile_badges_title")}</h2>
            <p className="section-description">{t("profile_badges_desc")}</p>
          </div>
        </div>
        {data.badges.length === 0 ? (
          <EmptyState title={t("profile_badges_empty_title")} description={t("profile_badges_empty_desc")} />
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
      </section>

      {/* Recent sessions */}
      <section className="card">
        <div className="section-header" style={{ marginBottom: 14 }}>
          <div className="stack-xs">
            <h2 className="section-title">{t("profile_sessions_title")}</h2>
            <p className="section-description">{t("profile_sessions_desc")}</p>
          </div>
        </div>
        {data.recentSessions.length === 0 ? (
          <EmptyState
            title={t("profile_sessions_empty_title")}
            description={t("profile_sessions_empty_desc")}
          />
        ) : (
          <RecentSessions sessions={data.recentSessions} />
        )}
      </section>
    </div>
  );
}
