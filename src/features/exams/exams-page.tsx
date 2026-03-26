"use client";

import type { Exam } from "@/contracts/study-focus";
import { FormEvent, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
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
import { calculateCountdownDays, formatDate } from "@/lib/format";
import { getReadableErrorMessage } from "@/lib/ui-error";
import { getStudyFocusApi } from "@/services/study-focus-api";

const studyFocusApi = getStudyFocusApi();

function resolveExamTypeLabel(type: string) {
  if (type === "official") {
    return "班級考試";
  }

  if (type === "mock") {
    return "模擬考";
  }

  return "自訂";
}

export function ExamsPage() {
  const {
    data,
    errorMessage,
    errorStatus,
    isError,
    isLoading,
    reload,
    setData,
  } = useAsyncData(() => studyFocusApi.getExams(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [form, setForm] = useState({
    date: "",
    subjectScope: "",
    title: "",
  });
  const [notice, setNotice] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null);

  const sortedExams = useMemo(() => {
    if (!data) {
      return [];
    }

    return [...data].sort(
      (left, right) =>
        new Date(left.date).getTime() - new Date(right.date).getTime(),
    );
  }, [data]);
  const nextUpcomingExam = useMemo(
    () => sortedExams.find((exam) => calculateCountdownDays(exam.date) >= 0) ?? null,
    [sortedExams],
  );

  function openCreateModal() {
    setEditingExam(null);
    setForm({
      date: "",
      subjectScope: "",
      title: "",
    });
    setIsModalOpen(true);
  }

  function openEditModal(exam: Exam) {
    setEditingExam(exam);
    setForm({
      date: exam.date,
      subjectScope: exam.subjectScope,
      title: exam.title,
    });
    setIsModalOpen(true);
  }

  async function handleSubmitExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    try {
      if (editingExam) {
        const updatedExam = await studyFocusApi.updateExam(editingExam.id, {
          date: form.date,
          subjectScope: form.subjectScope.trim(),
          title: form.title.trim(),
        });
        setData((current) =>
          current
            ? current.map((exam) =>
                exam.id === updatedExam.id ? updatedExam : exam,
              )
            : current,
        );
        setNotice({
          text: `已更新「${updatedExam.title}」的倒數。`,
          tone: "success",
        });
      } else {
        const nextExam = await studyFocusApi.createExam({
          date: form.date,
          subjectScope: form.subjectScope.trim(),
          title: form.title.trim(),
        });
        setData((current) => (current ? [nextExam, ...current] : [nextExam]));
        setNotice({
          text: "自訂考試已加入倒數清單。",
          tone: "success",
        });
      }

      setForm({ date: "", subjectScope: "", title: "" });
      setIsModalOpen(false);
      setEditingExam(null);
      reload();
    } catch (reason) {
      setNotice({
        text: getReadableErrorMessage(reason, "考試資料儲存失敗。"),
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteExam(exam: Exam) {
    const confirmed = window.confirm(`要刪除「${exam.title}」嗎？`);

    if (!confirmed) {
      return;
    }

    setDeletingExamId(exam.id);
    setNotice(null);

    try {
      await studyFocusApi.deleteExam(exam.id);
      setData((current) =>
        current ? current.filter((item) => item.id !== exam.id) : current,
      );
      setNotice({
        text: `已刪除「${exam.title}」。`,
        tone: "success",
      });
    } catch (reason) {
      setNotice({
        text: getReadableErrorMessage(reason, "刪除考試失敗。"),
        tone: "error",
      });
    } finally {
      setDeletingExamId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="page">
        <LoadingState label="正在整理考試倒數。" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page">
        {errorStatus === 401 ? (
          <AuthRequiredState description="登入後才能查看與管理你的考試倒數。" />
        ) : (
          <ErrorState description={errorMessage ?? "考試資料載入失敗。"} onRetry={reload} />
        )}
      </div>
    );
  }

  return (
    <div className="page stack-lg">
      <PageHeader
        eyebrow="考試倒數"
        title="知道還剩幾天，讀書方向會更清楚。"
        description="把重要考試列進來，先看最近的，再決定這週要先補哪一科。"
        actions={<Button onClick={openCreateModal}>新增自訂考試</Button>}
      />

      {notice ? <NoticeBanner tone={notice.tone}>{notice.text}</NoticeBanner> : null}

      {nextUpcomingExam ? (
        <SectionCard
          title="最近提醒"
          description="用最近的一場考試幫自己把這幾天的優先順序排清楚。"
          muted
        >
          <div className="compact-stats">
            <div className="compact-stat">
              <span className="stat-label">最近考試</span>
              <p className="metric-value">{nextUpcomingExam.title}</p>
            </div>
            <div className="compact-stat">
              <span className="stat-label">剩餘時間</span>
              <p className="metric-value">{calculateCountdownDays(nextUpcomingExam.date)} 天</p>
            </div>
            <div className="compact-stat">
              <span className="stat-label">建議節奏</span>
              <p className="metric-value">
                {calculateCountdownDays(nextUpcomingExam.date) <= 7
                  ? "今天至少再補一輪"
                  : calculateCountdownDays(nextUpcomingExam.date) <= 21
                    ? "先把每天節奏守住"
                    : "這週先穩定累積"}
              </p>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {!sortedExams.length ? (
        <EmptyState
          title="還沒有考試資料"
          description="先新增最近的一場考試，倒數才會開始運作。"
          action={<Button onClick={openCreateModal}>新增第一場考試</Button>}
        />
      ) : (
        <SectionCard
          title="主要考試"
          description="自訂考試可直接編輯；班級共用考試目前先提供唯讀查看。"
        >
          <div className="section-grid section-grid--3">
            {sortedExams.map((exam) => {
              const countdownDays = calculateCountdownDays(exam.date);
              const isEditable = exam.type === "custom";

              return (
                <article key={exam.id} className="exam-card">
                  <div className="card-header-row">
                    <span className="subject-pill">{resolveExamTypeLabel(exam.type)}</span>
                    <span className="meta-text">{exam.subjectScope}</span>
                  </div>

                  <div className="stack-sm">
                    <strong>{exam.title}</strong>
                    <span
                      className={
                        countdownDays < 0
                          ? "exam-countdown exam-countdown--past"
                          : "exam-countdown"
                      }
                    >
                      {countdownDays < 0 ? "已結束" : `${countdownDays} 天`}
                    </span>
                    <span className="meta-text">{formatDate(exam.date)}</span>
                  </div>

                  <div className="button-row">
                    {isEditable ? (
                      <>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => openEditModal(exam)}
                        >
                          編輯
                        </Button>
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => void handleDeleteExam(exam)}
                          disabled={deletingExamId === exam.id}
                        >
                          {deletingExamId === exam.id ? "刪除中..." : "刪除"}
                        </Button>
                      </>
                    ) : (
                      <span className="meta-text">班級共用考試目前為唯讀</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </SectionCard>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingExam ? "編輯自訂考試" : "新增自訂考試"}
        description="適合模擬考、小考、讀書會測驗或自己設定的提醒節點。"
      >
        <form className="field-grid" onSubmit={handleSubmitExam}>
          <div className="stack-xs">
            <label className="field-label" htmlFor="exam-title">
              考試名稱
            </label>
            <input
              id="exam-title"
              className="input"
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="例如：數學模擬考"
              required
            />
          </div>

          <div className="stack-xs">
            <label className="field-label" htmlFor="exam-date">
              日期
            </label>
            <input
              id="exam-date"
              type="date"
              className="input"
              value={form.date}
              onChange={(event) =>
                setForm((current) => ({ ...current, date: event.target.value }))
              }
              required
            />
          </div>

          <div className="stack-xs">
            <label className="field-label" htmlFor="exam-scope">
              科目 / 範圍
            </label>
            <input
              id="exam-scope"
              className="input"
              value={form.subjectScope}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  subjectScope: event.target.value,
                }))
              }
              placeholder="例如：英文閱讀、數學全冊"
              required
            />
          </div>

          <Button type="submit" disabled={isSubmitting} fullWidth>
            {isSubmitting
              ? editingExam
                ? "更新中..."
                : "新增中..."
              : editingExam
                ? "更新考試"
                : "加入倒數"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
