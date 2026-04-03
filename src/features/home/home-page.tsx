"use client";

import Link from "next/link";
import {
  AuthRequiredState,
  EmptyState,
  ErrorState,
  LoadingState,
  NoticeBanner,
} from "@/components/ui/state-panels";
import { getButtonClassName } from "@/components/ui/button";
import { useAsyncData } from "@/hooks/use-async-data";
import { calculateCountdownDays, formatDateTime, formatMinutes } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { getStudyFocusApi } from "@/services/study-focus-api";

const studyFocusApi = getStudyFocusApi();

export function HomePage() {
  const { t } = useI18n();
  const { data, errorMessage, errorStatus, isError, isLoading, reload } =
    useAsyncData(() => studyFocusApi.getDashboard(), []);

  if (isLoading) {
    return (
      <div className="page">
        <LoadingState label={t("home_loading")} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page">
        {errorStatus === 401 ? (
          <AuthRequiredState description={t("home_loading")} />
        ) : (
          <ErrorState description={errorMessage ?? t("home_loading")} onRetry={reload} />
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
        <EmptyState title={t("home_empty_title")} description={t("home_empty_desc")} />
      </div>
    );
  }

  const currentUserRank = data.leaderboardPreview.find((e) => e.isCurrentUser)?.rank;
  const nextExamDays = data.nextExam ? calculateCountdownDays(data.nextExam.date) : null;
  const leadingHighlight = data.classHighlights[0];

  return (
    <div className="page stack-lg dashboard-page">

      {/* ── Top bar ── */}
      <header style={{ paddingTop: 52, display: "grid", gap: 6 }}>
        <p className="eyebrow">{t("home_eyebrow")}</p>
        <h1 className="page-title">{t("home_title")}</h1>
        <p className="page-description">{t("home_desc")}</p>
      </header>

      {/* ── Achievement banner ── */}
      <NoticeBanner tone={data.achievementFeedback.tone}>
        <strong>{data.achievementFeedback.title}</strong> {data.achievementFeedback.message}
      </NoticeBanner>

      {/* ── Quick stats strip ── */}
      <div className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">{t("home_stat_today")}</span>
          <p className="stat-value">{formatMinutes(data.todayMinutes)}</p>
          <span className="meta-text">{t("home_stat_today_desc")}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">{t("home_stat_goal")}</span>
          <p className="stat-value">
            {formatMinutes(data.dailyGoal.currentMinutes)} / {formatMinutes(data.dailyGoal.targetMinutes)}
          </p>
          <span className="meta-text">{data.dailyGoal.statusText}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">{t("home_stat_weekly")}</span>
          <p className="stat-value">
            {data.weeklyTrend.direction === "up"
              ? t("home_trend_up")
              : data.weeklyTrend.direction === "down"
              ? t("home_trend_down")
              : t("home_trend_flat")}
          </p>
          <span className="meta-text">{data.weeklyTrend.summary}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">{t("home_stat_next_exam")}</span>
          <p className="stat-value">
            {nextExamDays === null ? t("home_stat_exam_none") : `${nextExamDays}${t("home_stat_exam_days")}`}
          </p>
          <span className="meta-text">
            {data.nextExam?.title ?? `${data.currentlyStudyingCount} ${t("home_studying_count")}`}
          </span>
        </article>
      </div>

      {/* ── Goal card ── */}
      <section className="dashboard-goal-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div className="stack-xs">
            <h2 className="section-title">{t("home_goal_title")}</h2>
            <p className="meta-text">{t("home_goal_desc")}</p>
          </div>
          <p className="dashboard-goal-card__minutes">{formatMinutes(data.todayMinutes)}</p>
        </div>

        {/* Badge strip */}
        <div className="hero-meta" style={{ marginTop: 4 }}>
          <span className="hero-badge">{t("home_today")} {formatMinutes(data.todayMinutes)}</span>
          <span className="hero-badge">{t("home_streak")} {data.streakDays}{t("home_streak_days")}</span>
          <span className="hero-badge">{data.dailyGoal.statusText}</span>
          {currentUserRank ? (
            <span className="hero-badge">{t("home_rank")}{currentUserRank}{t("home_rank_suffix")}</span>
          ) : null}
          {data.currentlyStudyingCount > 0 ? (
            <span className="hero-badge">{data.currentlyStudyingCount} {t("home_studying_count")}</span>
          ) : null}
        </div>

        {/* CTAs */}
        <div className="button-row" style={{ marginTop: 8 }}>
          <Link href="/focus" className={getButtonClassName("primary")}>{t("home_cta_focus")}</Link>
          <Link href="/leaderboard" className={getButtonClassName("secondary")}>{t("home_cta_leaderboard")}</Link>
        </div>
      </section>

      <hr className="page-divider" />

      {/* ── Leaderboard + Activity ── */}
      <div className="dashboard-hero">

        {/* Leaderboard preview */}
        <section className="card">
          <div className="section-header">
            <div className="stack-xs">
              <h2 className="section-title">{t("home_lb_title")}</h2>
              <p className="section-description">{t("home_lb_desc")}</p>
            </div>
            <Link href="/leaderboard" className="text-link">{t("home_lb_link")}</Link>
          </div>

          {data.leaderboardPreview.length === 0 ? (
            <EmptyState title={t("home_lb_empty_title")} description={t("home_lb_empty_desc")} />
          ) : (
            <div className="leaderboard-list" style={{ marginTop: 14 }}>
              {data.leaderboardPreview.map((entry) => (
                <article
                  key={entry.userId}
                  className={entry.isCurrentUser ? "top-rank-card top-rank-card--current" : "top-rank-card"}
                >
                  <div className="top-rank-row">
                    <div className="leaderboard-row__meta">
                      <span className={entry.rank <= 3 ? "leaderboard-rank leaderboard-rank--top" : "leaderboard-rank"}>
                        #{entry.rank}
                      </span>
                      <div className="stack-xs">
                        <strong>{entry.name}</strong>
                        <span className="meta-text">
                          {formatMinutes(entry.minutes)} · {t("lb_streak")} {entry.streakDays}{t("lb_streak_days")}
                          {entry.badgeLabel ? ` · ${entry.badgeLabel}` : ""}
                        </span>
                      </div>
                    </div>
                    <span className="trend-pill">
                      {entry.trend === "up" ? t("home_trend_up") : entry.trend === "down" ? t("home_trend_down") : t("home_trend_flat")}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Class activity */}
        <section className="card">
          <div className="section-header">
            <div className="stack-xs">
              <h2 className="section-title">{t("home_activity_title")}</h2>
              <p className="section-description">{t("home_activity_desc")}</p>
            </div>
            <Link href="/groups" className="text-link">{t("home_activity_link")}</Link>
          </div>

          {data.activeGroups.length === 0 ? (
            <EmptyState title={t("home_activity_empty_title")} description={t("home_activity_empty_desc")} />
          ) : (
            <div className="stack-md" style={{ marginTop: 14 }}>
              {leadingHighlight ? (
                <div className="notice-banner notice-banner--info">
                  <strong>{leadingHighlight.title}</strong> {leadingHighlight.description}
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
                      <strong>{group.liveStudyingCount} {t("home_online")}</strong>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <p className="meta-text" style={{ marginTop: 14 }}>
            {t("home_sync_time")}{formatDateTime(new Date().toISOString())}
          </p>
        </section>
      </div>
    </div>
  );
}
