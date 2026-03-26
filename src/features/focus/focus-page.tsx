"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TimerRing } from "@/components/focus/timer-ring";
import { Button, getButtonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import {
  AuthRequiredState,
  EmptyState,
  ErrorState,
  LoadingState,
  NoticeBanner,
} from "@/components/ui/state-panels";
import type { InterruptionReason, StudySessionDto } from "@/contracts";
import type { GroupSummary, SubjectTag } from "@/contracts/study-focus";
import { useAsyncData } from "@/hooks/use-async-data";
import { formatMinutes } from "@/lib/format";
import { localizeSubjectTags, resolveStudySubjectLabel } from "@/lib/study-subjects";
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
  achievementFeedback: {
    message: string;
    title: string;
    tone: "info" | "success";
  };
  currentlyStudyingCount: number;
  dailyGoal: {
    currentMinutes: number;
    isComplete: boolean;
    remainingMinutes: number;
    statusText: string;
    targetMinutes: number;
  };
  todaySessionCount: number;
  todayTotalMinutes: number;
  weeklyGoal: {
    currentMinutes: number;
    statusText: string;
    targetMinutes: number;
  };
  weeklyTrend: {
    direction: "down" | "same" | "up";
    summary: string;
  };
}

function resolveSessionSubjectId(
  session: StudySessionDto | null,
  subjects: SubjectTag[],
) {
  if (!session) {
    return subjects[0]?.id ?? "";
  }

  const directMatch = subjects.find((subject) => subject.id === session.title);
  return directMatch?.id ?? subjects[0]?.id ?? "";
}

function toRoundedMinutes(seconds: number) {
  return Math.max(1, Math.round(seconds / 60));
}

async function loadFocusPageData(): Promise<FocusPageData> {
  const [overview, groups, openSessions] = await Promise.all([
    studyFocusApi.getFocusOverview(),
    studyFocusApi.getGroups(),
    studyFocusV1Api.listOpenStudySessions(),
  ]);

  return {
    achievementFeedback: overview.achievementFeedback,
    currentlyStudyingCount: overview.currentlyStudyingCount,
    dailyGoal: overview.dailyGoal,
    groups,
    openSession: openSessions[0] ?? null,
    subjects: localizeSubjectTags(overview.subjects),
    todaySessionCount: overview.todaySessionCount,
    todayTotalMinutes: overview.todayTotalMinutes,
    weeklyGoal: overview.weeklyGoal,
    weeklyTrend: overview.weeklyTrend,
  };
}

export function FocusPage() {
  const {
    data,
    errorMessage,
    errorStatus,
    isError,
    isLoading,
    reload,
    setData,
  } = useAsyncData(loadFocusPageData, []);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [note, setNote] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [activeSession, setActiveSession] = useState<StudySessionDto | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pendingAction, setPendingAction] = useState<
    "pause" | "start" | "stop" | null
  >(null);
  const [notice, setNotice] = useState<{
    text: string;
    tone: "error" | "success" | "warning";
  } | null>(null);
  const autoStopSessionIdRef = useRef<string | null>(null);
  const lastInterruptionRef = useRef<{
    at: number;
    reason: InterruptionReason;
    sessionId: string;
  } | null>(null);

  useEffect(() => {
    if (!data) {
      return;
    }

    setSelectedGroupId((current) => {
      if (current) {
        return current;
      }

      return data.openSession?.groupId ?? data.groups[0]?.id ?? "";
    });

    setSelectedSubjectId((current) => {
      if (current) {
        return current;
      }

      return resolveSessionSubjectId(data.openSession, data.subjects);
    });
  }, [data]);

  useEffect(() => {
    if (!data?.openSession) {
      return;
    }

    setActiveSession(data.openSession);
    setSelectedGroupId(data.openSession.groupId);
    setSelectedSubjectId(resolveSessionSubjectId(data.openSession, data.subjects));
    setNote(data.openSession.notes ?? "");
  }, [data?.openSession?.id, data?.subjects]);

  useEffect(() => {
    if (!activeSession) {
      setElapsedSeconds(0);
      return;
    }

    setElapsedSeconds(activeSession.effectiveDurationSeconds);

    if (activeSession.status !== "active") {
      return;
    }

    const startedAt = Date.now();
    const baseline = activeSession.effectiveDurationSeconds;
    const timer = window.setInterval(() => {
      setElapsedSeconds(
        baseline + Math.floor((Date.now() - startedAt) / 1000),
      );
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [activeSession]);

  const reportInterruption = useCallback(
    async (reason: InterruptionReason) => {
      if (!activeSession || activeSession.status !== "active") {
        return;
      }

      const now = Date.now();
      const lastInterruption = lastInterruptionRef.current;

      if (
        lastInterruption &&
        lastInterruption.sessionId === activeSession.id &&
        lastInterruption.reason === reason &&
        now - lastInterruption.at < 3000
      ) {
        return;
      }

      lastInterruptionRef.current = {
        at: now,
        reason,
        sessionId: activeSession.id,
      };

      try {
        const nextSession =
          await studyFocusV1Api.reportStudySessionInterruption(activeSession.id, reason);
        setActiveSession(nextSession);
        setNotice({
          text: "偵測到你切離畫面，這次專注已標記為中斷。",
          tone: "warning",
        });
      } catch (reasonError) {
        setNotice({
          text: getReadableErrorMessage(reasonError, "中斷狀態回報失敗，請稍後再試。"),
          tone: "error",
        });
      }
    },
    [activeSession],
  );

  useEffect(() => {
    if (!activeSession || activeSession.status !== "active") {
      return;
    }

    const handleWindowBlur = () => {
      void reportInterruption("window_blur");
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        void reportInterruption("tab_hidden");
      }
    };

    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeSession?.id, activeSession?.status, reportInterruption]);

  const isRunning = activeSession?.status === "active";
  const hasSession = Boolean(activeSession);
  const localizedSubjects = data?.subjects ?? [];
  const currentGroup = useMemo(
    () => data?.groups.find((group) => group.id === selectedGroupId) ?? null,
    [data?.groups, selectedGroupId],
  );
  const currentSubjectLabel = resolveStudySubjectLabel(selectedSubjectId, "未選科目");
  const secondsRemaining = hasSession
    ? Math.max(SESSION_SECONDS - elapsedSeconds, 0)
    : SESSION_SECONDS;
  const timerStatusLabel = activeSession
    ? activeSession.status === "active"
      ? "專注進行中"
      : "已暫停"
    : "準備開始";
  const timerSubtitle = currentGroup
    ? `同步到 ${currentGroup.name} · ${currentSubjectLabel}`
    : `本輪科目：${currentSubjectLabel}`;

  async function handleStartOrResume() {
    setNotice(null);

    if (activeSession?.status === "paused") {
      setPendingAction("start");

      try {
        const resumedSession = await studyFocusV1Api.resumeStudySession(activeSession.id);
        setActiveSession(resumedSession);
        setNotice({
          text: "已繼續這一輪專注。",
          tone: "success",
        });
      } catch (reason) {
        setNotice({
          text: getReadableErrorMessage(reason, "恢復專注失敗。"),
          tone: "error",
        });
      } finally {
        setPendingAction(null);
      }

      return;
    }

    if (activeSession) {
      return;
    }

    if (!selectedGroupId) {
      setNotice({
        text: "請先加入或建立一個小組，專注紀錄才有地方同步。",
        tone: "error",
      });
      return;
    }

    if (!selectedSubjectId) {
      setNotice({
        text: "請先選一個科目再開始。",
        tone: "error",
      });
      return;
    }

    setPendingAction("start");

    try {
      const createdSession = await studyFocusV1Api.createStudySession({
        groupId: selectedGroupId,
        notes: note.trim() || null,
        title: selectedSubjectId,
      });
      setActiveSession(createdSession);
      setData((current) =>
        current
          ? {
              ...current,
              openSession: createdSession,
            }
          : current,
      );
      setNotice({
        text: `已開始本輪 ${currentSubjectLabel} 專注。`,
        tone: "success",
      });
    } catch (reason) {
      setNotice({
        text: getReadableErrorMessage(reason, "開始專注失敗。"),
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handlePause() {
    if (!activeSession) {
      return;
    }

    setPendingAction("pause");
    setNotice(null);

    try {
      const pausedSession = await studyFocusV1Api.pauseStudySession(activeSession.id);
      setActiveSession(pausedSession);
      setNotice({
        text: "已暫停，準備好再繼續。",
        tone: "success",
      });
    } catch (reason) {
      setNotice({
        text: getReadableErrorMessage(reason, "暫停失敗。"),
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleStop(autoStopped = false) {
    if (!activeSession) {
      return;
    }

    setPendingAction("stop");
    setNotice(null);

    try {
      const stoppedSession = await studyFocusV1Api.stopStudySession(activeSession.id);
      const completedMinutes = toRoundedMinutes(
        stoppedSession.effectiveDurationSeconds,
      );
      const crossedDailyGoal =
        data !== null &&
        data !== undefined &&
        data.todayTotalMinutes < data.dailyGoal.targetMinutes &&
        data.todayTotalMinutes + completedMinutes >= data.dailyGoal.targetMinutes;

      setActiveSession(null);
      setNote("");
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
      setNotice({
        text: crossedDailyGoal
          ? "這輪完成後，今天的目標也一起達標了。"
          : autoStopped
            ? "50 分鐘已完成，這輪專注已自動記錄。"
            : "本輪專注已完成並同步到今天的統計。",
        tone: "success",
      });
      reload();
    } catch (reason) {
      setNotice({
        text: getReadableErrorMessage(reason, "停止並記錄失敗。"),
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  useEffect(() => {
    if (!activeSession || activeSession.status !== "active") {
      autoStopSessionIdRef.current = null;
      return;
    }

    if (secondsRemaining > 0) {
      autoStopSessionIdRef.current = null;
      return;
    }

    if (autoStopSessionIdRef.current === activeSession.id) {
      return;
    }

    autoStopSessionIdRef.current = activeSession.id;
    void handleStop(true);
  }, [activeSession, secondsRemaining]);

  if (isLoading) {
    return (
      <div className="page">
        <LoadingState label="正在整理今天的專注摘要。" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page">
        {errorStatus === 401 ? (
          <AuthRequiredState description="登入後才能開始專注計時並同步到排行榜。" />
        ) : (
          <ErrorState description={errorMessage ?? "專注頁載入失敗。"} onRetry={reload} />
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
        <EmptyState
          title="沒有專注資料"
          description="讀書頁面還沒準備好，請重新整理再試一次。"
        />
      </div>
    );
  }

  if (!activeSession && data.groups.length === 0) {
    return (
      <div className="page stack-lg">
        <PageHeader
          eyebrow="專注計時"
          title="先加入小組，才能把專注紀錄同步進排行榜。"
          description="目前後端的專注 session 需要綁定小組，先建立或加入一個就能開始。"
        />
        <EmptyState
          title="還沒有可同步的小組"
          description="建立第一個小組後，就能開始 50 分鐘專注計時。"
          action={
            <Link href="/groups" className={getButtonClassName("primary")}>
              前往小組頁
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className={`page stack-lg${focusMode ? " page--focus-mode" : ""}`}>
      <PageHeader
        eyebrow="專注計時"
        title="把這一輪讀完，先穩住今天的節奏。"
        description="50 分鐘專注循環，支援中斷提醒、暫停續讀，並直接同步到你的真實讀書紀錄。"
      />

      {notice ? <NoticeBanner tone={notice.tone}>{notice.text}</NoticeBanner> : null}

      <div className="timer-layout">
        <SectionCard>
          <div className="timer-shell">
            <TimerRing
              secondsRemaining={secondsRemaining}
              totalSeconds={SESSION_SECONDS}
              statusLabel={timerStatusLabel}
              subtitle={timerSubtitle}
            />

            <div className="button-row button-row--center">
              <Button
                onClick={handleStartOrResume}
                disabled={pendingAction !== null || isRunning}
              >
                {!activeSession
                  ? "開始"
                  : activeSession.status === "paused"
                    ? "繼續"
                    : "專注中"}
              </Button>
              <Button
                variant="secondary"
                onClick={handlePause}
                disabled={!isRunning || pendingAction !== null}
              >
                暫停
              </Button>
              <Button
                variant="ghost"
                onClick={() => void handleStop(false)}
                disabled={!activeSession || pendingAction !== null}
              >
                停止並記錄
              </Button>
            </div>

            <div className="focus-summary-strip">
              <div className="focus-summary-strip__item">
                <span className="stat-label">今日總時數</span>
                <strong>{formatMinutes(data.todayTotalMinutes)}</strong>
              </div>
              <div className="focus-summary-strip__item">
                <span className="stat-label">完成場次</span>
                <strong>{data.todaySessionCount} 回</strong>
              </div>
              <div className="focus-summary-strip__item">
                <span className="stat-label">同步小組</span>
                <strong>{currentGroup?.name ?? "未選擇"}</strong>
              </div>
              <div className="focus-summary-strip__item">
                <span className="stat-label">今日目標</span>
                <strong>{data.dailyGoal.isComplete ? "已達標" : `${data.dailyGoal.remainingMinutes} 分鐘`}</strong>
              </div>
            </div>
          </div>
        </SectionCard>

        {!focusMode ? (
          <div className="section-grid">
            <SectionCard
              title="本輪設定"
              description="開始之後設定會鎖定，避免中途改動影響紀錄。"
            >
              <div className="field-grid">
                {data.groups.length > 1 ? (
                  <div className="stack-xs">
                    <label className="field-label" htmlFor="focus-group">
                      同步到小組
                    </label>
                    <select
                      id="focus-group"
                      className="select"
                      value={selectedGroupId}
                      onChange={(event) => setSelectedGroupId(event.target.value)}
                      disabled={hasSession}
                    >
                      {data.groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name} · {group.liveStudyingCount} 人在線
                        </option>
                      ))}
                    </select>
                  </div>
                ) : currentGroup ? (
                  <div className="compact-stat">
                    <span className="stat-label">同步小組</span>
                    <p className="metric-value">{currentGroup.name}</p>
                  </div>
                ) : null}

                <div className="stack-sm">
                  <label className="field-label">科目標籤</label>
                  <div className="chip-row">
                    {localizedSubjects.map((subject) => (
                      <button
                        key={subject.id}
                        type="button"
                        className={
                          selectedSubjectId === subject.id
                            ? "chip chip--active"
                            : "chip"
                        }
                        onClick={() => setSelectedSubjectId(subject.id)}
                        disabled={hasSession}
                      >
                        {subject.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="stack-sm">
                  <label className="field-label" htmlFor="session-note">
                    本次備註
                  </label>
                  <textarea
                    id="session-note"
                    className="textarea"
                    placeholder="例如：數學錯題整理、英文單字第 12 回"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    disabled={hasSession}
                  />
                  <p className="field-help">目前備註會在開始時一起寫入這輪 session。</p>
                </div>

                <div className="toggle-row">
                  <div className="stack-xs">
                    <span className="field-label">沉浸模式</span>
                    <p className="field-help">
                      開啟後會收起右側資訊，只保留最核心的計時畫面。
                    </p>
                  </div>
                  <button
                    type="button"
                    className={focusMode ? "toggle toggle--active" : "toggle"}
                    onClick={() => setFocusMode((value) => !value)}
                    aria-pressed={focusMode}
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="進度提示"
              description="目標、班級動態和中斷提醒都放在這裡，開讀前先快速掃一眼。"
              muted
            >
              <div className="list-stack">
                <div className="compact-stat">
                  <span className="stat-label">目前科目</span>
                  <p className="metric-value">{currentSubjectLabel}</p>
                </div>
                <div className="compact-stat">
                  <span className="stat-label">目前狀態</span>
                  <p className="metric-value">{timerStatusLabel}</p>
                </div>
                <div className="compact-stat">
                  <span className="stat-label">今日目標</span>
                  <p className="metric-value">
                    {formatMinutes(data.dailyGoal.currentMinutes)} / {formatMinutes(data.dailyGoal.targetMinutes)}
                  </p>
                </div>
                <div className="compact-stat">
                  <span className="stat-label">本週目標</span>
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
                  <span className="stat-label">目前有人在讀</span>
                  <p className="metric-value">
                    {currentGroup?.liveStudyingCount ?? data.currentlyStudyingCount} 人
                  </p>
                </div>
              </div>
              <p className="meta-text">{data.weeklyTrend.summary}</p>
              <p className="meta-text">
                {data.achievementFeedback.title} · {data.achievementFeedback.message}
              </p>
              <p className="meta-text">
                如果切換分頁或離開視窗，後端會把這輪 session 標記為有中斷。
              </p>
            </SectionCard>
          </div>
        ) : null}
      </div>
    </div>
  );
}
