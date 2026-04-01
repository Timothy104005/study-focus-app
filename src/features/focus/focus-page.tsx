"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
const STOP_DRAG_THRESHOLD_PX = 56;
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

const focusDrawerItems = [
  { href: "/focus", label: "Focus" },
  { href: "/groups", label: "Group" },
  { href: "/exams", label: "Plan" },
  { href: "/leaderboard", label: "Record" },
  { href: "/profile", label: "Mine" },
] as const;

function FocusCanvasShell({
  children,
  isSidebarOpen,
  onSidebarOpen,
  onSidebarClose,
  isNoteOpen,
  onNoteToggle,
  notesDraft,
  onNotesChange,
}: {
  children: React.ReactNode;
  isSidebarOpen: boolean;
  onSidebarOpen: () => void;
  onSidebarClose: () => void;
  isNoteOpen: boolean;
  onNoteToggle: () => void;
  notesDraft: string;
  onNotesChange: (value: string) => void;
}) {
  return (
    <div className="focus-mobile">
      <section className="focus-mobile__canvas">
        <div className="focus-mobile__line-vertical" aria-hidden />
        <div className="focus-mobile__line-horizontal" aria-hidden />

        <button
          type="button"
          className="focus-mobile__sidebar-trigger"
          onClick={onSidebarOpen}
          aria-label="開啟導覽"
        >
          ≡
        </button>

        {children}
      </section>

      <aside className={`focus-mobile__drawer ${isSidebarOpen ? "is-open" : ""}`}>
        <nav className="focus-mobile__drawer-nav" aria-label="Focus 導覽">
          {focusDrawerItems.map((item) => (
            <Link key={item.href} href={item.href} className="focus-mobile__drawer-item" onClick={onSidebarClose}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <button
        type="button"
        className={`focus-mobile__drawer-overlay ${isSidebarOpen ? "is-open" : ""}`}
        onClick={onSidebarClose}
        aria-label="關閉導覽"
      />

      <button
        type="button"
        className={`focus-mobile__note-tab ${isNoteOpen ? "is-open" : ""}`}
        onClick={onNoteToggle}
      >
        Note
      </button>

      <aside className={`focus-mobile__note-panel ${isNoteOpen ? "is-open" : ""}`}>
        <label htmlFor="focus-note-textarea">筆記 Note</label>
        <textarea
          id="focus-note-textarea"
          value={notesDraft}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="記錄現在的想法..."
        />
      </aside>
    </div>
  );
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [dragOffset, setDragOffset] = useState(0);
  const [isDraggingStop, setIsDraggingStop] = useState(false);
  const dragStartYRef = useRef<number | null>(null);
  const isInterruptingFromTabBlurRef = useRef(false);

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

  useEffect(() => {
    if (!activeSession || activeSession.status !== "active") {
      isInterruptingFromTabBlurRef.current = false;
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") {
        return;
      }
      if (isInterruptingFromTabBlurRef.current) {
        return;
      }

      isInterruptingFromTabBlurRef.current = true;
      void studyFocusV1Api
        .interruptStudySession(activeSession.id, "tab_blur")
        .then((interruptedSession) => {
          setActiveSession(interruptedSession);
          setNotice({
            tone: "error",
            text: "偵測到切換分頁，已中斷本輪專注，請回到頁面後重新開始。",
          });
        })
        .catch((reason) => {
          setNotice({
            tone: "error",
            text: getReadableErrorMessage(reason, "切換分頁時中斷專注失敗。"),
          });
        })
        .finally(() => {
          isInterruptingFromTabBlurRef.current = false;
        });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
              todayTotalMinutes: Math.max(
                current.todayTotalMinutes + completedMinutes,
                Math.round((dailyTotalDisplaySeconds - runningSessionSeconds + stopped.effectiveDurationSeconds) / 60),
              ),
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

  const canShowRunningLayout = activeSession?.status === "active";
  const hasGroups = (data?.groups.length ?? 0) > 0;

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
    <FocusCanvasShell
      isSidebarOpen={isSidebarOpen}
      onSidebarOpen={() => setIsSidebarOpen(true)}
      onSidebarClose={() => setIsSidebarOpen(false)}
      isNoteOpen={isNoteOpen}
      onNoteToggle={() => setIsNoteOpen((current) => !current)}
      notesDraft={notesDraft}
      onNotesChange={setNotesDraft}
    >
      <div className="focus-mobile__content">
        {notice ? <NoticeBanner tone={notice.tone}>{notice.text}</NoticeBanner> : null}

        <header className="focus-mobile__header">
          <p>Learning time</p>
          <strong>{formatHHMMSS(dailyTotalDisplaySeconds)}</strong>
          <em>Be confident</em>
          {canShowRunningLayout ? <span>{formatMMSS(elapsedSeconds)}</span> : null}
        </header>

        <div className="focus-mobile__controls">
          <label htmlFor="focus-subject" className="sr-only">
            科目
          </label>
          <select
            id="focus-subject"
            className="focus-mobile__pill-select"
            value={selectedSubjectId}
            onChange={(event) => setSelectedSubjectId(event.target.value)}
            disabled={Boolean(activeSession) || !data}
          >
            {data?.subjects.map((subject) => (
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
            className="focus-mobile__pill-select"
            value={selectedGroupId}
            onChange={(event) => setSelectedGroupId(event.target.value)}
            disabled={Boolean(activeSession) || !hasGroups}
          >
            {data?.groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        {!hasGroups && data ? (
          <NoticeBanner tone="error">
            目前尚未加入任何小組，請先前往 <Link href="/groups">小組頁面</Link> 建立或加入小組後再開始專注。
          </NoticeBanner>
        ) : null}

        {isLoading ? <LoadingState label="正在載入專注頁面..." /> : null}
        {isError ? (
          errorStatus === 401 ? (
            <AuthRequiredState description="請先登入才能開始專注計時。" />
          ) : (
            <ErrorState description={errorMessage ?? "專注頁載入失敗。"} onRetry={reload} />
          )
        ) : null}
        {!isLoading && !isError && !data ? (
          <EmptyState title="目前沒有專注資料" description="請稍後再試一次。" />
        ) : null}

        {!canShowRunningLayout ? (
          <div className="focus-mobile__start-zone">
            <p className="focus-mobile__start-label">start</p>
            {hasGroups ? (
              <button
                type="button"
                className="focus-mobile__start-bar"
                onClick={() => void handleStartOrResume()}
                disabled={pendingAction !== null || isLoading || isError}
                aria-label="start study session"
              />
            ) : null}
            {activeSession?.status === "paused" ? (
              <button
                type="button"
                className="focus-mobile__resume-button"
                onClick={() => void handleStartOrResume()}
                disabled={pendingAction !== null}
              >
                繼續暫停中的專注
              </button>
            ) : null}
          </div>
        ) : (
          <div className="focus-mobile__start-zone focus-mobile__start-zone--running">
            <p className="focus-mobile__start-label">start</p>
            <div
              className="focus-mobile__stop-track"
              onPointerMove={(event) => handleStopDragMove(event.clientY)}
              onPointerUp={handleStopDragEnd}
              onPointerCancel={handleStopDragEnd}
            >
              <div className="focus-mobile__stop-fill" style={{ height: `${Math.max(12, barProgress * 100)}%` }} />
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
                style={{ transform: `translate(-50%, ${dragOffset}px)` }}
                aria-label="drag down to stop"
              />
            </div>
            <div className="focus-mobile__session-meta">
              <span>Session {formatMMSS(elapsedSeconds)}</span>
              <span>剩餘 {formatMMSS(secondsRemaining)}</span>
            </div>
          </div>
        )}
      </div>
    </FocusCanvasShell>
  );
}
