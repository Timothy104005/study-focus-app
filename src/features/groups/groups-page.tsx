"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
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
import { useI18n } from "@/lib/i18n";
import { getReadableErrorMessage } from "@/lib/ui-error";
import { getStudyFocusApi } from "@/services/study-focus-api";

const studyFocusApi = getStudyFocusApi();

export function GroupsPage() {
  const { t } = useI18n();
  const { data, errorMessage, errorStatus, isError, isLoading, reload, setData } =
    useAsyncData(() => studyFocusApi.getGroups(), []);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ className: "", description: "", name: "" });
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "error" | "success" } | null>(null);

  function resetCreateForm() {
    setCreateForm({ className: "", description: "", name: "" });
  }

  function openCreateModal() {
    resetCreateForm();
    setIsCreateModalOpen(true);
  }

  async function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setNotice(null);
    try {
      const createdGroup = await studyFocusApi.createGroup({
        className: createForm.className.trim(),
        description: createForm.description.trim(),
        name: createForm.name.trim(),
      });
      setData((current) =>
        current ? [createdGroup, ...current.filter((g) => g.id !== createdGroup.id)] : [createdGroup],
      );
      setNotice({ text: `「${createdGroup.name}」 created. Start studying together.`, tone: "success" });
      setIsCreateModalOpen(false);
      resetCreateForm();
    } catch (reason) {
      setNotice({ text: getReadableErrorMessage(reason, "Failed to create group."), tone: "error" });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoinGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!joinCode.trim()) {
      setNotice({ text: t("groups_join_code_label"), tone: "error" });
      return;
    }
    setIsJoining(true);
    setNotice(null);
    try {
      const joinedGroup = await studyFocusApi.joinGroup({ joinCode: joinCode.trim() });
      setData((current) => {
        if (!current) return [joinedGroup];
        const exists = current.some((g) => g.id === joinedGroup.id);
        return exists
          ? current.map((g) => (g.id === joinedGroup.id ? joinedGroup : g))
          : [joinedGroup, ...current];
      });
      setJoinCode("");
      setNotice({ text: `Joined「${joinedGroup.name}」.`, tone: "success" });
    } catch (reason) {
      setNotice({ text: getReadableErrorMessage(reason, "Failed to join group."), tone: "error" });
    } finally {
      setIsJoining(false);
    }
  }

  if (isLoading) {
    return (
      <div className="page">
        <LoadingState label={t("groups_loading")} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page">
        {errorStatus === 401 ? (
          <AuthRequiredState description={t("groups_auth_desc")} />
        ) : (
          <ErrorState description={errorMessage ?? t("groups_loading")} onRetry={reload} />
        )}
      </div>
    );
  }

  const groups = data ?? [];

  return (
    <div className="page stack-lg">

      {/* Header */}
      <header style={{ paddingTop: 52, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div className="stack-xs">
          <p className="eyebrow">{t("groups_eyebrow")}</p>
          <h1 className="page-title">{t("groups_title")}</h1>
          <p className="page-description">{t("groups_desc")}</p>
        </div>
        <div style={{ paddingTop: 32 }}>
          <Button onClick={openCreateModal}>{t("groups_create_btn")}</Button>
        </div>
      </header>

      {notice ? <NoticeBanner tone={notice.tone}>{notice.text}</NoticeBanner> : null}

      {/* Join form — compact, on top */}
      <section className="card card--muted">
        <div className="section-header" style={{ marginBottom: 14 }}>
          <div className="stack-xs">
            <h2 className="section-title">{t("groups_join_title")}</h2>
            <p className="section-description">{t("groups_join_desc")}</p>
          </div>
        </div>
        <form
          className="stack-sm"
          onSubmit={handleJoinGroup}
          style={{ flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}
        >
          <div className="stack-xs" style={{ flex: "1 1 200px" }}>
            <label className="field-label" htmlFor="join-code">
              {t("groups_join_code_label")}
            </label>
            <input
              id="join-code"
              className="input"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder={t("groups_join_code_hint")}
              autoCapitalize="characters"
            />
          </div>
          <Button type="submit" disabled={isJoining}>
            {isJoining ? t("groups_joining") : t("groups_join_btn")}
          </Button>
        </form>
      </section>

      {/* Joined groups */}
      <section className="card">
        <div className="section-header" style={{ marginBottom: 14 }}>
          <div className="stack-xs">
            <h2 className="section-title">{t("groups_joined_title")}</h2>
            <p className="section-description">{t("groups_joined_desc")}</p>
          </div>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.78rem",
            color: "var(--text-faint)",
            fontWeight: 700,
          }}>
            {groups.length} {t("groups_people")}
          </span>
        </div>

        {groups.length === 0 ? (
          <EmptyState
            title={t("groups_empty_title")}
            description={t("groups_empty_desc")}
            action={<Button onClick={openCreateModal}>{t("groups_empty_btn")}</Button>}
          />
        ) : (
          <div className="group-list">
            {groups.map((group) => (
              <Link key={group.id} href={`/groups/${group.id}`} className="group-card">
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div className="stack-xs">
                    <strong>{group.name}</strong>
                    <p className="section-description">{group.description}</p>
                  </div>
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.78rem",
                    color: group.liveStudyingCount > 0 ? "var(--cyan-300)" : "var(--text-faint)",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}>
                    {group.liveStudyingCount} {t("groups_studying")}
                  </span>
                </div>
                <div className="group-card__footer">
                  <div className="chip-row">
                    <span className="subject-pill">{group.className}</span>
                    <span className="subject-pill">{group.memberCount} {t("groups_people")}</span>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--text-faint)" }}>
                    {t("groups_invite_code")} {group.joinCode}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Create modal */}
      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t("groups_create_title")}
        description={t("groups_create_desc")}
      >
        <form className="field-grid" onSubmit={handleCreateGroup}>
          <div className="stack-xs">
            <label className="field-label" htmlFor="group-name">{t("groups_name_label")}</label>
            <input
              id="group-name"
              className="input"
              value={createForm.name}
              onChange={(e) => setCreateForm((c) => ({ ...c, name: e.target.value }))}
              placeholder={t("groups_name_hint")}
              required
            />
          </div>
          <div className="stack-xs">
            <label className="field-label" htmlFor="group-class-name">{t("groups_class_label")}</label>
            <input
              id="group-class-name"
              className="input"
              value={createForm.className}
              onChange={(e) => setCreateForm((c) => ({ ...c, className: e.target.value }))}
              placeholder={t("groups_class_hint")}
              required
            />
          </div>
          <div className="stack-xs">
            <label className="field-label" htmlFor="group-description">{t("groups_desc_label")}</label>
            <textarea
              id="group-description"
              className="textarea"
              value={createForm.description}
              onChange={(e) => setCreateForm((c) => ({ ...c, description: e.target.value }))}
              placeholder={t("groups_desc_hint")}
              required
            />
          </div>
          <Button type="submit" disabled={isCreating} fullWidth>
            {isCreating ? t("groups_creating") : t("groups_submit")}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
