"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
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
import { getReadableErrorMessage } from "@/lib/ui-error";
import { getStudyFocusApi } from "@/services/study-focus-api";

const studyFocusApi = getStudyFocusApi();

export function GroupsPage() {
  const {
    data,
    errorMessage,
    errorStatus,
    isError,
    isLoading,
    reload,
    setData,
  } = useAsyncData(() => studyFocusApi.getGroups(), []);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    className: "",
    description: "",
    name: "",
  });
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [notice, setNotice] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(null);

  function resetCreateForm() {
    setCreateForm({
      className: "",
      description: "",
      name: "",
    });
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

      setData((current) => {
        if (!current) {
          return [createdGroup];
        }

        return [createdGroup, ...current.filter((group) => group.id !== createdGroup.id)];
      });
      setNotice({
        text: `已建立「${createdGroup.name}」，現在可以直接開始同步讀書。`,
        tone: "success",
      });
      setIsCreateModalOpen(false);
      resetCreateForm();
    } catch (reason) {
      setNotice({
        text: getReadableErrorMessage(reason, "建立小組失敗。"),
        tone: "error",
      });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoinGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!joinCode.trim()) {
      setNotice({
        text: "請先輸入邀請碼。",
        tone: "error",
      });
      return;
    }

    setIsJoining(true);
    setNotice(null);

    try {
      const joinedGroup = await studyFocusApi.joinGroup({
        joinCode: joinCode.trim(),
      });

      setData((current) => {
        if (!current) {
          return [joinedGroup];
        }

        const exists = current.some((group) => group.id === joinedGroup.id);
        return exists
          ? current.map((group) => (group.id === joinedGroup.id ? joinedGroup : group))
          : [joinedGroup, ...current];
      });
      setJoinCode("");
      setNotice({
        text: `已加入「${joinedGroup.name}」。`,
        tone: "success",
      });
    } catch (reason) {
      setNotice({
        text: getReadableErrorMessage(reason, "加入小組失敗。"),
        tone: "error",
      });
    } finally {
      setIsJoining(false);
    }
  }

  if (isLoading) {
    return (
      <div className="page">
        <LoadingState label="正在整理你的小組清單。" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page">
        {errorStatus === 401 ? (
          <AuthRequiredState description="登入後才能查看已加入的小組與邀請碼。" />
        ) : (
          <ErrorState description={errorMessage ?? "小組資料載入失敗。"} onRetry={reload} />
        )}
      </div>
    );
  }

  const groups = data ?? [];

  return (
    <div className="page stack-lg">
      <PageHeader
        eyebrow="讀書小組"
        title="先進到同一組，專注、討論和排行榜才會接起來。"
        description="這裡會整理你已加入的小組，也可以用邀請碼快速加入，或直接建立新的讀書組。"
        actions={<Button onClick={openCreateModal}>建立小組</Button>}
      />

      {notice ? <NoticeBanner tone={notice.tone}>{notice.text}</NoticeBanner> : null}

      <div className="split-grid split-grid--sidebar">
        <SectionCard
          title="已加入的小組"
          description="優先看現在有人在讀的組，最容易直接接上節奏。"
        >
          {groups.length === 0 ? (
            <EmptyState
              title="還沒有加入任何小組"
              description="先建立自己的讀書小組，或輸入同學給你的邀請碼。"
              action={<Button onClick={openCreateModal}>建立第一個小組</Button>}
            />
          ) : (
            <div className="group-list">
              {groups.map((group) => (
                <Link key={group.id} href={`/groups/${group.id}`} className="group-card">
                  <div className="stack-sm">
                    <div className="stack-xs">
                      <strong>{group.name}</strong>
                      <p className="section-description">{group.description}</p>
                    </div>
                    <div className="chip-row">
                      <span className="subject-pill">{group.className}</span>
                      <span className="subject-pill">{group.memberCount} 人</span>
                      <span className="subject-pill">{group.liveStudyingCount} 人在讀</span>
                    </div>
                  </div>
                  <div className="group-card__footer">
                    <span>邀請碼 {group.joinCode}</span>
                    <strong>查看小組</strong>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="加入現有小組"
          description="拿到邀請碼後直接加入，排行榜和討論板就會同步出現。"
          muted
        >
          <form className="field-grid" onSubmit={handleJoinGroup}>
            <div className="stack-xs">
              <label className="field-label" htmlFor="join-code">
                邀請碼
              </label>
              <input
                id="join-code"
                className="input"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="例如：DAAN3A"
                autoCapitalize="characters"
              />
            </div>

            <Button type="submit" disabled={isJoining} fullWidth>
              {isJoining ? "加入中..." : "立即加入"}
            </Button>
          </form>
        </SectionCard>
      </div>

      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="建立新小組"
        description="適合班內讀書組、段考衝刺組，或幾個同學一起維持節奏。"
      >
        <form className="field-grid" onSubmit={handleCreateGroup}>
          <div className="stack-xs">
            <label className="field-label" htmlFor="group-name">
              小組名稱
            </label>
            <input
              id="group-name"
              className="input"
              value={createForm.name}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="例如：段考衝刺班"
              required
            />
          </div>

          <div className="stack-xs">
            <label className="field-label" htmlFor="group-class-name">
              班級 / 標籤
            </label>
            <input
              id="group-class-name"
              className="input"
              value={createForm.className}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, className: event.target.value }))
              }
              placeholder="例如：高三自然組"
              required
            />
          </div>

          <div className="stack-xs">
            <label className="field-label" htmlFor="group-description">
              小組說明
            </label>
            <textarea
              id="group-description"
              className="textarea"
              value={createForm.description}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="例如：平日晚上 8 點一起讀一輪，讀完互相回報。"
              required
            />
          </div>

          <Button type="submit" disabled={isCreating} fullWidth>
            {isCreating ? "建立中..." : "送出建立"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
