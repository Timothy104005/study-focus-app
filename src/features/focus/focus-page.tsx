"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
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
const STOP_DRAG_THRESHOLD_PX = 80;
const INTERRUPTION_COOLDOWN_MS = 15_000;
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
  sessionLoadWarning: string | null;
}

function formatHHMMSS(totalSeconds: number) {
  const safeSeconds = Math.max(totalSeconds, 0);
  const hours = Math.floor(safeSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((safeSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
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
  const [overview, groups] = await Promise.all([
    studyFocusApi.getFocusOverview(),
    studyFocusApi.getGroups(),
  ]);

  let openSession: StudySessionDto | null = null;
  let sessionLoadWarning: string | null = null;

  try {
    const openSessions = await studyFocusV1Api.listOpenStudySessions();
    openSession = openSessions[0] ?? null;
  } catch (reason) {
    sessionLoadWarning = getReadableErrorMessage(
      reason,
      "目前無法同步未完成的專注狀態，先以新 session 模式顯示。",
    );
  }

  return {
    groups,
    openSession,
    subjects: localizeSubjectTags(overview.subjects),
    currentlyStudyingCount: overview.currentlyStudyingCount,
    todaySessionCount: overview.todaySessionCount,
    todayTotalMinutes: overview.todayTotalMinutes,
    dailyGoal: {
      currentMinutes: overview.dailyGoal.currentMinutes,
      targetMinutes: overview.dailyGoal.targetMinutes,
    },
    sessionLoadWarning,
  };
}

export function FocusPage() {
  const router = useRouter();
  const { data, errorMessage, errorStatus, isError, isLoading, reload, setData } =
    useAsyncData(loadFocusPageData, []);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [activeSession, setActiveSession] = useState<StudySessionDto | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pendingAction, setPendingAction] = useState<
    "start" | "pause" | "stop" | null
  >(null);
  const [notice, setNotice] = useState<{
    tone: "error" | "success" | "warning" | "info";
    text: string;
  } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [dragOffset, setDragOffset] = useState(0);
  const [isDraggingStop, setIsDraggingStop] = useState(false);
  const dragStartYRef = useRef<number | null>(null);
  const interruptionLockRef = useRef(false);
  const lastInterruptionAtRef = useRef(0);

  function syncOpenSession(nextSession: StudySessionDto | null) {
    setActiveSession(nextSession);
    setData((current) =>
      current ? { ...current, openSession: nextSession } : current,
    );
  }

  useEffect(() => {
    if (!data) {
      return;
    }

    setSelectedGroupId((current) => current || data.openSession?.groupId || data.groups[0]?.id || "");
    setSelectedSubjectId((current) => current || data.subjects[0]?.id || "");
    setActiveSession(data.openSession);
  }, [data]);

  useEffect(() => {
    if (!data?.sessionLoadWarning) {
      return;
    }

    setNotice((current) =>
      current ?? { tone: "warning", text: data.sessionLoadWarning as string },
    );
  }, [data?.sessionLoadWarning]);

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

  useEffect(() => {
    if (!activeSession || activeSession.status !== "active") {
      return;
    }

    async function reportInterruption(reason: "tab_hidden" | "window_blur") {
      const now = Date.now();

      if (
        interruptionLockRef.current ||
        now - lastInterruptionAtRef.current < INTERRUPTION_COOLDOWN_MS
      ) {
        return;
      }

      interruptionLockRef.current = true;
      lastInterruptionAtRef.current = now;

      try {
        const updated = await studyFocusV1Api.reportStudySessionInterruption(
          activeSession.id,
          reason,
        );
        syncOpenSession(updated);
      } catch (reason) {
        setNotice({
          tone: "warning",
          text: getReadableErrorMessage(
            reason,
            "已偵測到離開頁面，但中斷狀態同步失敗。",
          ),
        });
      } finally {
        interruptionLockRef.current = false;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        void reportInterruption("tab_hidden");
      }
    }

    function handleWindowBlur() {
      void reportInterruption("window_blur");
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [activeSession]);

  const secondsRemaining = activeSession
    ? Math.max(SESSION_SECONDS - elapsedSeconds, 0)
    : SESSION_SECONDS;
  const dailyTotalBaseSeconds = (data?.todayTotalMinutes ?? 0) * 60;
  const runningSessionSeconds = activeSession?.status === "active" ? elapsedSeconds : 0;
  const dailyTotalDisplaySeconds = dailyTotalBaseSeconds + runningSessionSeconds;
  const barProgress = Math.min(elapsedSeconds / SESSION_SECONDS, 1);

  async function handleStartOrResume() {
    setNotice(null);
    setPendingAction("start");

    try {
      if (activeSession && activeSession.status === "paused") {
        const resumed = await studyFocusV1Api.resumeStudySession(activeSession.id);
        syncOpenSession(resumed);
        setNotice({ tone: "success", text: "已繼續本輪專注。" });
        return;
      }

      if (!selectedGroupId) {
        setNotice({ tone: "error", text: "請先加入或選擇小組。" });
        return;
      }

      if (!selectedSubjectId) {
        setNotice({ tone: "error", text: "請先選擇科目。" });
        return;
      }

      const created = await studyFocusV1Api.createStudySession({
        groupId: selectedGroupId,
        title: selectedSubjectId,
        notes: notesDraft.trim() || null,
      });
      syncOpenSession(created);
      setNotice({ tone: "success", text: "專注計時已開始，保持節奏！" });
    } catch (reason) {
      setNotice({ tone: "error", text: getReadableErrorMessage(reason, "開始專注失敗。") });
    } finally {
      setPendingAction(null);
    }
  }

  async function handlePause() {
    if (!activeSession) {
      return;
    }

    setNotice(null);
    setPendingAction("pause");

    try {
      const paused = await studyFocusV1Api.pauseStudySession(activeSession.id);
      syncOpenSession(paused);
      setNotice({ tone: "success", text: "已暫停這輪專注。" });
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
      syncOpenSession(null);
      setData((current) =>
        current
          ? {
              ...current,
              openSession: null,
              todaySessionCount: current.todaySessionCount + 1,
              todayTotalMinutes: current.todayTotalMinutes + completedMinutes,
              dailyGoal: {
                ...current.dailyGoal,
                currentMinutes: current.dailyGoal.currentMinutes + completedMinutes,
              },
            }
          : current,
      );
      setDragOffset(0);
      setIsDraggingStop(false);
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

  if (data.groups.length === 0 && !data.openSession && !activeSession) {
    return (
      <div className="page">
        <EmptyState
          title="還不能開始專注"
          description="你還沒有加入任何小組，所以目前沒有可綁定的專注 session。"
          action={
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => router.push("/groups")}
            >
              先去加入小組
            </button>
          }
        />
      </div>
    );
  }

  const navItems: Array<{ label: string; href: Route }> = [
    { label: "首頁", href: "/" },
    { label: "專注", href: "/focus" },
    { label: "小組", href: "/groups" },
    { label: "考試", href: "/exams" },
    { label: "排行", href: "/leaderboard" },
    { label: "我的", href: "/profile" },
  ];

  const canShowRunningLayout = activeSession?.status === "active";
  const isPaused = activeSession?.status === "paused";

  function handleStopDragStart(clientY: number) {
    if (!canShowRunningLayout || pendingAction !== null) {
      return;
    }
    dragStartYRef.current = clientY;
    setIsDraggingStop(true);
  }

  function handleStopDragMove(clientY: number) {
    if (!isDraggingStop || dragStartYRef.current === null) {
      return;
    }
    const offset = Math.max(clientY - dragStartYRef.current, 0);
    setDragOffset(offset);
  }

  function handleStopDragEnd() {
    if (!isDraggingStop) {
      return;
    }
    const reachedThreshold = dragOffset >= STOP_DRAG_THRESHOLD_PX;
    setIsDraggingStop(false);
    setDragOffset(0);
    dragStartYRef.current = null;

    if (reachedThreshold) {
      void handleStop();
    }
  }

  return (
    <div className="page focus-mobile">
      <aside className={`focus-mobile__sidebar ${isSidebarOpen ? "is-open" : ""}`}>
        <button
          type="button"
          className="focus-mobile__close-sidebar"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          ×
        </button>
        <nav className="focus-mobile__nav">
          {navItems.map((item, index) => (
            <div key={`${item.label}-${index}`} className="focus-mobile__nav-wrap">
              <button
                type="button"
                className={`focus-mobile__nav-item ${item.href === "/focus" ? "is-primary" : ""}`}
                onClick={() => {
                  setIsSidebarOpen(false);
                  router.push(item.href);
                }}
              >
                {item.label}
              </button>
              {index < navItems.length - 1 ? <span className="focus-mobile__nav-square" /> : null}
            </div>
          ))}
        </nav>
      </aside>

      {isSidebarOpen ? (
        <button
          type="button"
          className="focus-mobile__sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="close sidebar overlay"
        />
      ) : null}

      <section className="focus-mobile__canvas">
        {notice ? <NoticeBanner tone={notice.tone}>{notice.text}</NoticeBanner> : null}
        <button
          type="button"
          className="focus-mobile__sidebar-trigger"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="open sidebar"
        >
          ☰
        </button>
        <div className="focus-mobile__crossline" />

        <header className="focus-mobile__header">
          <p>Learning time</p>
          <strong>{formatHHMMSS(dailyTotalDisplaySeconds)}</strong>
          <em>{isPaused ? "Paused safely" : "Be confident"}</em>
        </header>

        <div className="focus-mobile__controls">
          <label htmlFor="focus-subject" className="sr-only">
            科目
          </label>
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
          <label htmlFor="focus-group" className="sr-only">
            小組
          </label>
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
        </div>

        {!canShowRunningLayout ? (
          <div className="focus-mobile__idle">
            <p className="focus-mobile__start-label">{isPaused ? "paused" : "start"}</p>
            {isPaused ? (
              <>
                <strong>{formatMMSS(elapsedSeconds)}</strong>
                <div className="button-row">
                  <button
                    type="button"
                    className="btn btn--primary btn--small"
                    onClick={() => void handleStartOrResume()}
                    disabled={pendingAction !== null}
                  >
                    {pendingAction === "start" ? "繼續中..." : "繼續"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--small"
                    onClick={() => void handleStop()}
                    disabled={pendingAction !== null}
                  >
                    {pendingAction === "stop" ? "結束中..." : "結束"}
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="focus-mobile__start-bar"
                onClick={() => void handleStartOrResume()}
                disabled={pendingAction !== null}
                aria-label="start study session"
              />
            )}
          </div>
        ) : (
          <div className="focus-mobile__running">
            <div className="focus-mobile__learning-label">Learning</div>
            <div
              className="focus-mobile__rising-track"
              onPointerUp={handleStopDragEnd}
              onPointerCancel={handleStopDragEnd}
              onPointerMove={(event) => handleStopDragMove(event.clientY)}
            >
              <div
                className="focus-mobile__rising-fill"
                style={{ height: `${Math.max(barProgress * 100, 6)}%` }}
              />
              <button
                type="button"
                className="focus-mobile__drag-stop-handle"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  handleStopDragStart(event.clientY);
                }}
                onPointerMove={(event) => handleStopDragMove(event.clientY)}
                onPointerUp={(event) => {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                  handleStopDragEnd();
                }}
                onPointerCancel={handleStopDragEnd}
                style={{ transform: `translateY(${dragOffset}px)` }}
                aria-label="drag down to stop"
              >
                ⬇
              </button>
            </div>
            <div className="focus-mobile__running-footer">
              <span>stop</span>
              <span>{formatMMSS(elapsedSeconds)}</span>
            </div>
            <div className="button-row">
              <button
                type="button"
                className="btn btn--secondary btn--small"
                onClick={() => void handlePause()}
                disabled={pendingAction !== null}
              >
                {pendingAction === "pause" ? "暫停中..." : "暫停"}
              </button>
              <button
                type="button"
                className="focus-mobile__stop-fallback"
                onClick={() => void handleStop()}
                disabled={pendingAction !== null}
              >
                {pendingAction === "stop" ? "停止中..." : "停止（備用）"}
              </button>
            </div>
          </div>
        )}

        <div className="focus-mobile__meta">
          <p>今日場次 {data.todaySessionCount}</p>
          <p>
            目標 {data.dailyGoal.currentMinutes}/{data.dailyGoal.targetMinutes} 分鐘
          </p>
          <p>在線 {data.currentlyStudyingCount}</p>
          <p>剩餘 {formatMMSS(secondsRemaining)}</p>
          <p>
            狀態 {canShowRunningLayout ? "專注中" : isPaused ? "暫停中" : "待開始"}
          </p>
        </div>
      </section>

      <button
        type="button"
        className={`focus-mobile__note-tab ${isNoteOpen ? "is-open" : ""}`}
        onClick={() => setIsNoteOpen((current) => !current)}
      >
        Note
      </button>

      <aside className={`focus-mobile__note-panel ${isNoteOpen ? "is-open" : ""}`}>
        <label htmlFor="focus-note-textarea">筆記</label>
        <textarea
          id="focus-note-textarea"
          value={notesDraft}
          onChange={(event) => setNotesDraft(event.target.value)}
          placeholder="記錄現在的想法..."
        />
      </aside>
    </div>
  );
}
