"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getButtonClassName } from "@/components/ui/button";
import {
  AuthRequiredState,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/state-panels";
import { useAsyncData } from "@/hooks/use-async-data";
import { formatDateTime, formatMinutes } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { getStudyFocusApi } from "@/services/study-focus-api";

const studyFocusApi = getStudyFocusApi();

export function LeaderboardPage() {
  const { t } = useI18n();
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>();
  const [range, setRange] = useState<"daily" | "weekly">("daily");
  const { data, errorMessage, errorStatus, isError, isLoading, reload } = useAsyncData(
    () => studyFocusApi.getLeaderboard(selectedClassId),
    [selectedClassId],
  );

  const currentUserEntry = useMemo(() => {
    if (!data) return null;
    const ranking = range === "daily" ? data.daily : data.weekly;
    return ranking.find((e) => e.isCurrentUser) ?? null;
  }, [data, range]);

  if (isLoading) {
    return (
      <div className="page">
        <LoadingState label={t("lb_loading")} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page">
        {errorStatus === 401 ? (
          <AuthRequiredState description={t("lb_auth_desc")} />
        ) : (
          <ErrorState description={errorMessage ?? t("lb_loading")} onRetry={reload} />
        )}
      </div>
    );
  }

  if (!data || data.classOptions.length === 0) {
    return (
      <div className="page">
        <EmptyState
          title={t("lb_no_data_title")}
          description={t("lb_no_data_desc")}
          action={
            <Link href="/groups" className={getButtonClassName("primary")}>
              {t("lb_to_groups")}
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

      {/* Header */}
      <header style={{ paddingTop: 52, display: "grid", gap: 6 }}>
        <p className="eyebrow">{t("lb_eyebrow")}</p>
        <h1 className="page-title">{t("lb_title")}</h1>
        <p className="page-description">{t("lb_desc")}</p>
      </header>

      {/* Controls row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {/* Group selector */}
        <div className="stack-xs" style={{ flex: "1 1 180px", minWidth: 0 }}>
          <label className="field-label" htmlFor="leaderboard-class">
            {t("lb_class_label")}
          </label>
          <select
            id="leaderboard-class"
            className="select"
            value={selectValue}
            onChange={(e) => setSelectedClassId(e.target.value)}
          >
            {data.classOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name} · {opt.memberCount} {t("lb_members_count")}
              </option>
            ))}
          </select>
        </div>

        {/* Range tabs */}
        <div className="stack-xs">
          <span className="field-label">{t("lb_range_label")}</span>
          <div className="tab-set">
            <button
              type="button"
              className={range === "daily" ? "tab-button tab-button--active" : "tab-button"}
              onClick={() => setRange("daily")}
            >
              {t("lb_daily")}
            </button>
            <button
              type="button"
              className={range === "weekly" ? "tab-button tab-button--active" : "tab-button"}
              onClick={() => setRange("weekly")}
            >
              {t("lb_weekly")}
            </button>
          </div>
        </div>
      </div>

      {/* My stats strip */}
      <div className="compact-stats">
        <div className="compact-stat">
          <span className="stat-label">{t("lb_stat_rank")}</span>
          <p className="metric-value">
            {currentUserEntry ? `#${currentUserEntry.rank}` : t("lb_stat_rank_none")}
          </p>
        </div>
        <div className="compact-stat">
          <span className="stat-label">{t("lb_stat_hours")}</span>
          <p className="metric-value">
            {currentUserEntry ? formatMinutes(currentUserEntry.minutes) : "0"}
          </p>
        </div>
        <div className="compact-stat">
          <span className="stat-label">{t("lb_stat_studying")}</span>
          <p className="metric-value">{data.currentlyStudyingCount}</p>
        </div>
        <div className="compact-stat">
          <span className="stat-label">{t("lb_stat_goal")}</span>
          <p className="metric-value">
            {data.dailyGoal.isComplete
              ? t("lb_goal_done")
              : `${data.dailyGoal.remainingMinutes} ${t("lb_goal_remain")}`}
          </p>
        </div>
      </div>

      {/* Highlights */}
      {data.weeklyTrend.summary ? (
        <p className="meta-text">{data.weeklyTrend.summary}</p>
      ) : null}

      {/* Rankings table */}
      <section className="card">
        <div className="section-header" style={{ marginBottom: 14 }}>
          <div className="stack-xs">
            <h2 className="section-title">
              {range === "daily" ? t("lb_daily_title") : t("lb_weekly_title")}
            </h2>
            <p className="section-description">{t("lb_board_desc")}</p>
          </div>
          <p className="meta-text" style={{ fontSize: "0.78rem" }}>
            {t("lb_last_updated")}{formatDateTime(data.updatedAt)}
          </p>
        </div>

        {ranking.length === 0 ? (
          <EmptyState title={t("lb_empty_title")} description={t("lb_empty_desc")} />
        ) : (
          <div className="leaderboard-list">
            {ranking.map((entry) => (
              <article
                key={`${range}-${entry.userId}`}
                className={entry.isCurrentUser ? "leaderboard-row leaderboard-row--current" : "leaderboard-row"}
              >
                <div className="leaderboard-row__meta">
                  <span className={
                    entry.rank === 1
                      ? "leaderboard-rank leaderboard-rank--first"
                      : entry.rank <= 3
                      ? "leaderboard-rank leaderboard-rank--top"
                      : "leaderboard-rank"
                  }>
                    #{entry.rank}
                  </span>
                  <div className="stack-xs">
                    <strong>{entry.name}</strong>
                    <span className="meta-text">
                      {entry.className} · {t("lb_streak")} {entry.streakDays}{t("lb_streak_days")}
                      {entry.badgeLabel ? ` · ${entry.badgeLabel}` : ""}
                    </span>
                  </div>
                </div>
                <div className="stack-xs" style={{ alignItems: "flex-end" }}>
                  <strong style={{ fontFamily: "var(--font-mono)" }}>{formatMinutes(entry.minutes)}</strong>
                  <span className="trend-pill">
                    {entry.isCurrentUser
                      ? t("lb_you")
                      : entry.trend === "up"
                      ? t("home_trend_up")
                      : entry.trend === "down"
                      ? t("home_trend_down")
                      : t("home_trend_flat")}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Class highlights */}
      {data.classHighlights.length > 0 ? (
        <div className="stack-xs">
          {data.classHighlights.map((h) => (
            <p key={h.title} className="meta-text">{h.title} · {h.description}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
