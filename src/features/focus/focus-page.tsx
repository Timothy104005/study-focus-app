"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AuthRequiredState,
  EmptyState,
  ErrorState,
  LoadingState,
  NoticeBanner,
} from "@/components/ui/state-panels";
import type { StudySessionDto } from "@/contracts";
import type { GroupSummary, SubjectTag } from "@/contracts/study-focus";
import { useAsyncData } from "@/hooks/use-async-data";
import { localizeSubjectTags } from "@/lib/study-subjects";
import { getReadableErrorMessage } from "@/lib/ui-error";
import { getStudyFocusApi } from "@/services/study-focus-api";
import { getStudyFocusV1Api } from "@/services/study-focus-v1-api";

const SESSION_SECONDS = 50 * 60;
const studyFocusApi = getStudyFocusApi();
const studyFocusV1Api = getStudyFocusV1Api();

interface FocusPageData {
  groups: GroupSummary[];
  openSession: StudySessionDto | null;
  subjects: SubjectTag[];
  currentlyStudyingCount: number;
  todaySessionCount: number;
  todayTotalMinutes: number;
  dailyGoal: {
    currentMinutes: number;
    targetMinutes: number;
  };
}

function formatMMSS(totalSeconds: number) {
  const safeSeconds = Math.max(totalSeconds, 0);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

async function loadFocusPageData(): Promise<FocusPageData> {
  const [overview, groups, openSessions] = await Promise.all([
    studyFocusApi.getFocusOverview(),
    studyFocusApi.getGroups(),
    studyFocusV1Api.listOpenStudySessions(),
  ]);

  return {
    groups,
    openSession: openSessions[0] ?? null,
    subjects: localizeSubjectTags(overview.subjects),
    currentlyStudyingCount: overview.currentlyStudyingCount,
    todaySessionCount: overview.todaySessionCount,
    todayTotalMinutes: overview.todayTotalMinutes,
    dailyGoal: {
      currentMinutes: overview.dailyGoal.currentMinutes,
      targetMinutes: overview.dailyGoal.targetMinutes,
    },
  };
}

export function FocusPage() {
  const { data, errorMessage, errorStatus, isError, isLoading, reload, setData } =
    useAsyncData(loadFocusPageData, []);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [activeSession, setActiveSession] = useState<StudySessionDto | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pendingAction, setPendingAction] = useState<"start" | "pause" | "stop" | null>(
    null,
  );
  const [notice, setNotice] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!data) {
      return;
    }

    setSelectedGroupId((current) => current || data.openSession?.groupId || data.groups[0]?.id || "");
    setSelectedSubjectId((current) => current || data.subjects[0]?.id || "");
    setActiveSession(data.openSession);
  }, [data]);

  useEffect(() => {
    if (!activeSession) {
      setElapsedSeconds(0);
      return;
    }

    setElapsedSeconds(activeSession.effectiveDurationSeconds);

    if (activeSession.status !== "active") {
      return;
    }

    const baseline = activeSession.effectiveDurationSeconds;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(baseline + Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeSession]);

  const secondsRemaining = activeSession
    ? Math.max(SESSION_SECONDS - elapsedSeconds, 0)
    : SESSION_SECONDS;

  const leaderboardGroups = useMemo(
    () => [...(data?.groups ?? [])].sort((a, b) => b.liveStudyingCount - a.liveStudyingCount).slice(0, 5),
    [data?.groups],
  );

  async function handleStartOrResume() {
    setNotice(null);
    setPendingAction("start");

    try {
      if (activeSession && activeSession.status === "paused") {
        const resumed = await studyFocusV1Api.resumeStudySession(activeSession.id);
        setActiveSession(resumed);
        setNotice({ tone: "success", text: "已繼續本輪專注。" });
        return;
      }

      if (!selectedGroupId || !selectedSubjectId) {
        setNotice({ tone: "error", text: "請先選擇科目與小組。" });
        return;
      }

      const created = await studyFocusV1Api.createStudySession({
        groupId: selectedGroupId,
        title: selectedSubjectId,
        notes: null,
      });
      setActiveSession(created);
      setData((current) => (current ? { ...current, openSession: created } : current));
      setNotice({ tone: "success", text: "專注計時已開始，保持節奏！" });
    } catch (reason) {
      setNotice({ tone: "error", text: getReadableErrorMessage(reason, "開始專注失敗。") });
    } finally {
      setPendingAction(null);
    }
  }

  async function handlePause() {
    if (!activeSession) return;

    setNotice(null);
    setPendingAction("pause");
    try {
      const paused = await studyFocusV1Api.pauseStudySession(activeSession.id);
      setActiveSession(paused);
      setNotice({ tone: "success", text: "已暫停，可稍後繼續。" });
    } catch (reason) {
      setNotice({ tone: "error", text: getReadableErrorMessage(reason, "暫停失敗。") });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleStop() {
    if (!activeSession) return;

    setNotice(null);
    setPendingAction("stop");
    try {
      const stopped = await studyFocusV1Api.stopStudySession(activeSession.id);
      const completedMinutes = Math.max(1, Math.round(stopped.effectiveDurationSeconds / 60));
      setActiveSession(null);
      setData((current) =>
        current
          ? {
              ...current,
              openSession: null,
              todaySessionCount: current.todaySessionCount + 1,
              todayTotalMinutes: current.todayTotalMinutes + completedMinutes,
            }
          : current,
      );
      setNotice({ tone: "success", text: "本輪已結束並完成紀錄。" });
    } catch (reason) {
      setNotice({ tone: "error", text: getReadableErrorMessage(reason, "停止失敗。") });
    } finally {
      setPendingAction(null);
    }
  }

  if (isLoading) {
    return (
      <div className="page">
        <LoadingState label="正在載入專注頁面..." />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page">
        {errorStatus === 401 ? (
          <AuthRequiredState description="請先登入才能開始專注計時。" />
        ) : (
          <ErrorState description={errorMessage ?? "專注頁載入失敗。"} onRetry={reload} />
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
        <EmptyState title="目前沒有專注資料" description="請稍後再試一次。" />
      </div>
    );
  }

  return (
    <div className="page">
      <section className="focus-redesign">
        <aside className="focus-redesign__panel focus-redesign__panel--left">
          <h2>讀書設定</h2>
          <label htmlFor="focus-subject">科目</label>
          <select
            id="focus-subject"
            className="select"
            value={selectedSubjectId}
            onChange={(event) => setSelectedSubjectId(event.target.value)}
            disabled={Boolean(activeSession)}
          >
            {data.subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.label}
              </option>
            ))}
          </select>

          <label htmlFor="focus-group">小組</label>
          <select
            id="focus-group"
            className="select"
            value={selectedGroupId}
            onChange={(event) => setSelectedGroupId(event.target.value)}
            disabled={Boolean(activeSession)}
          >
            {data.groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>

          <div className="focus-redesign__stats">
            <p>今日專注：{data.todayTotalMinutes} 分鐘</p>
            <p>完成場次：{data.todaySessionCount} 場</p>
            <p>目標進度：{data.dailyGoal.currentMinutes}/{data.dailyGoal.targetMinutes} 分鐘</p>
            <p>目前在線：{data.currentlyStudyingCount} 人</p>
          </div>
        </aside>

        <main className="focus-redesign__center">
          {notice ? <NoticeBanner tone={notice.tone}>{notice.text}</NoticeBanner> : null}
          <div className="focus-redesign__timer-circle">
            <p className="focus-redesign__timer-label">
              {activeSession?.status === "active" ? "專注中" : activeSession ? "已暫停" : "準備開始"}
            </p>
            <strong>{formatMMSS(secondsRemaining)}</strong>
          </div>
          <div className="focus-redesign__controls">
            <button
              type="button"
              onClick={() => void handleStartOrResume()}
              disabled={pendingAction !== null || activeSession?.status === "active"}
            >
              {activeSession?.status === "paused" ? "繼續" : "開始"}
            </button>
            <button
              type="button"
              onClick={() => void handlePause()}
              disabled={pendingAction !== null || activeSession?.status !== "active"}
            >
              暫停
            </button>
            <button
              type="button"
              onClick={() => void handleStop()}
              disabled={pendingAction !== null || !activeSession}
            >
              停止
            </button>
          </div>
        </main>

        <aside className="focus-redesign__panel focus-redesign__panel--right">
          <h2>排行榜快照</h2>
          {leaderboardGroups.length === 0 ? (
            <p>目前沒有小組資料。</p>
          ) : (
            <ol className="focus-redesign__leaderboard">
              {leaderboardGroups.map((group, index) => (
                <li key={group.id}>
                  <span>#{index + 1} {group.name}</span>
                  <span>{group.liveStudyingCount} 人專注中</span>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </section>
    </div>
  );
}
