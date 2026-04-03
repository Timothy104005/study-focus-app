"use client";

import type { Exam } from "@/contracts/study-focus";
import { FormEvent, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  AuthRequiredState,
  EmptyState,
  ErrorState,
  LoadingState,
  NoticeBanner,
} from "@/components/ui/state-panels";
import { useAsyncData } from "@/hooks/use-async-data";
import { calculateCountdownDays, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { getReadableErrorMessage } from "@/lib/ui-error";
import { getStudyFocusApi } from "@/services/study-focus-api";

const studyFocusApi = getStudyFocusApi();

export function ExamsPage() {
  const { t } = useI18n();
  const { data, errorMessage, errorStatus, isError, isLoading, reload, setData } =
    useAsyncData(() => studyFocusApi.getExams(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [form, setForm] = useState({ date: "", subjectScope: "", title: "" });
  const [notice, setNotice] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null);

  const sortedExams = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data]);

  const nextUpcomingExam = useMemo(
    () => sortedExams.find((e) => calculateCountdownDays(e.date) >= 0) ?? null,
    [sortedExams],
  );

  function resolveExamTypeLabel(type: string) {
    if (type === "official") return t("exams_type_official");
    if (type === "mock") return t("exams_type_mock");
    return t("exams_type_custom");
  }

  function openCreateModal() {
    setEditingExam(null);
    setForm({ date: "", subjectScope: "", title: "" });
    setIsModalOpen(true);
  }

  function openEditModal(exam: Exam) {
    setEditingExam(exam);
    setForm({ date: exam.date, subjectScope: exam.subjectScope, title: exam.title });
    setIsModalOpen(true);
  }

  async function handleSubmitExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);
    try {
      if (editingExam) {
        const updated = await studyFocusApi.updateExam(editingExam.id, {
          date: form.date,
          subjectScope: form.subjectScope.trim(),
          title: form.title.trim(),
        });
        setData((current) => current ? current.map((e) => (e.id === updated.id ? updated : e)) : current);
        setNotice({ text: `「${updated.title}」 updated.`, tone: "success" });
      } else {
        const next = await studyFocusApi.createExam({
          date: form.date,
          subjectScope: form.subjectScope.trim(),
          title: form.title.trim(),
        });
        setData((current) => (current ? [next, ...current] : [next]));
        setNotice({ text: "Exam added to countdown.", tone: "success" });
      }
      setForm({ date: "", subjectScope: "", title: "" });
      setIsModalOpen(false);
      setEditingExam(null);
      reload();
    } catch (reason) {
      setNotice({ text: getReadableErrorMessage(reason, "Failed to save exam."), tone: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteExam(exam: Exam) {
    const confirmed = window.confirm(`Delete「${exam.title}」?`);
    if (!confirmed) return;
    setDeletingExamId(exam.id);
    setNotice(null);
    try {
      await studyFocusApi.deleteExam(exam.id);
      setData((current) => current ? current.filter((e) => e.id !== exam.id) : current);
      setNotice({ text: `「${exam.title}」 deleted.`, tone: "success" });
    } catch (reason) {
      setNotice({ text: getReadableErrorMessage(reason, "Failed to delete."), tone: "error" });
    } finally {
      setDeletingExamId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="page">
        <LoadingState label={t("exams_loading")} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page">
        {errorStatus === 401 ? (
          <AuthRequiredState description={t("exams_auth_desc")} />
        ) : (
          <ErrorState description={errorMessage ?? t("exams_loading")} onRetry={reload} />
        )}
      </div>
    );
  }

  return (
    <div className="page stack-lg">

      {/* Header */}
      <header style={{ paddingTop: 52, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div className="stack-xs">
          <p className="eyebrow">{t("exams_eyebrow")}</p>
          <h1 className="page-title">{t("exams_title")}</h1>
          <p className="page-description">{t("exams_desc")}</p>
        </div>
        <div style={{ paddingTop: 32 }}>
          <Button onClick={openCreateModal}>{t("exams_add_btn")}</Button>
        </div>
      </header>

      {notice ? <NoticeBanner tone={notice.tone}>{notice.text}</NoticeBanner> : null}

      {/* Next exam highlight */}
      {nextUpcomingExam ? (
        <section className="dashboard-goal-card">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div className="stack-xs">
              <h2 className="section-title">{t("exams_next_title")}</h2>
              <p className="meta-text">{t("exams_next_desc")}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p className="dashboard-goal-card__minutes">
                {calculateCountdownDays(nextUpcomingExam.date)}{t("exams_days")}
              </p>
              <p className="meta-text">{nextUpcomingExam.title}</p>
            </div>
          </div>
          <div className="compact-stats">
            <div className="compact-stat">
              <span className="stat-label">{t("exams_next_exam")}</span>
              <p className="metric-value">{nextUpcomingExam.title}</p>
            </div>
            <div className="compact-stat">
              <span className="stat-label">{t("exams_remaining")}</span>
              <p className="metric-value">{calculateCountdownDays(nextUpcomingExam.date)} {t("exams_days")}</p>
            </div>
            <div className="compact-stat" style={{ gridColumn: "1 / -1" }}>
              <span className="stat-label">{t("exams_suggestion")}</span>
              <p className="metric-value">
                {calculateCountdownDays(nextUpcomingExam.date) <= 7
                  ? t("exams_hint_7")
                  : calculateCountdownDays(nextUpcomingExam.date) <= 21
                  ? t("exams_hint_21")
                  : t("exams_hint_far")}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Exam grid */}
      {!sortedExams.length ? (
        <EmptyState
          title={t("exams_empty_title")}
          description={t("exams_empty_desc")}
          action={<Button onClick={openCreateModal}>{t("exams_empty_btn")}</Button>}
        />
      ) : (
        <section className="card">
          <div className="section-header" style={{ marginBottom: 16 }}>
            <div className="stack-xs">
              <h2 className="section-title">{t("exams_main_title")}</h2>
              <p className="section-description">{t("exams_main_desc")}</p>
            </div>
          </div>
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
                  <div className="stack-xs">
                    <strong>{exam.title}</strong>
                    <span className={countdownDays < 0 ? "exam-countdown exam-countdown--past" : "exam-countdown"}>
                      {countdownDays < 0 ? t("exams_past") : `${countdownDays}${t("exams_days")}`}
                    </span>
                    <span className="meta-text">{formatDate(exam.date)}</span>
                  </div>
                  <div className="button-row">
                    {isEditable ? (
                      <>
                        <Button variant="secondary" size="small" onClick={() => openEditModal(exam)}>
                          {t("exams_edit_btn")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => void handleDeleteExam(exam)}
                          disabled={deletingExamId === exam.id}
                        >
                          {deletingExamId === exam.id ? t("exams_deleting") : t("exams_delete_btn")}
                        </Button>
                      </>
                    ) : (
                      <span className="meta-text">{t("exams_readonly")}</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingExam ? t("exams_edit_title") : t("exams_create_title")}
        description={t("exams_modal_desc")}
      >
        <form className="field-grid" onSubmit={handleSubmitExam}>
          <div className="stack-xs">
            <label className="field-label" htmlFor="exam-title">{t("exams_title_label")}</label>
            <input
              id="exam-title"
              className="input"
              value={form.title}
              onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
              placeholder={t("exams_title_hint")}
              required
            />
          </div>
          <div className="stack-xs">
            <label className="field-label" htmlFor="exam-date">{t("exams_date_label")}</label>
            <input
              id="exam-date"
              type="date"
              className="input"
              value={form.date}
              onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))}
              required
            />
          </div>
          <div className="stack-xs">
            <label className="field-label" htmlFor="exam-scope">{t("exams_scope_label")}</label>
            <input
              id="exam-scope"
              className="input"
              value={form.subjectScope}
              onChange={(e) => setForm((c) => ({ ...c, subjectScope: e.target.value }))}
              placeholder={t("exams_scope_hint")}
              required
            />
          </div>
          <Button type="submit" disabled={isSubmitting} fullWidth>
            {isSubmitting
              ? editingExam ? t("exams_submitting_edit") : t("exams_submitting_create")
              : editingExam ? t("exams_submit_edit") : t("exams_submit_create")}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
