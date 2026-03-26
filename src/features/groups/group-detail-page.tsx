"use client";

import { FormEvent, useState } from "react";
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
import { formatDateTime, formatMinutes } from "@/lib/format";
import { getReadableErrorMessage } from "@/lib/ui-error";
import { getStudyFocusApi } from "@/services/study-focus-api";

const studyFocusApi = getStudyFocusApi();

export function GroupDetailPage({ groupId }: { groupId: string }) {
  const {
    data,
    errorMessage,
    errorStatus,
    isError,
    isLoading,
    reload,
    setData,
  } = useAsyncData(() => studyFocusApi.getGroupDetail(groupId), [groupId]);
  const [postContent, setPostContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePostActionId, setActivePostActionId] = useState<string | null>(null);
  const [activeSessionActionId, setActiveSessionActionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(null);

  async function handleCopyJoinCode() {
    if (!data) {
      return;
    }

    try {
      await navigator.clipboard.writeText(data.group.joinCode);
      setNotice({
        text: `已複製邀請碼 ${data.group.joinCode}。`,
        tone: "success",
      });
    } catch {
      setNotice({
        text: "邀請碼複製失敗，請手動複製。",
        tone: "error",
      });
    }
  }

  async function handleSubmitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!postContent.trim()) {
      setNotice({
        text: "先寫一點內容再送出。",
        tone: "error",
      });
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    try {
      const nextPost = await studyFocusApi.createGroupPost(groupId, {
        content: postContent.trim(),
      });
      setData((current) =>
        current
          ? {
              ...current,
              posts: [nextPost, ...current.posts],
            }
          : current,
      );
      setPostContent("");
      setNotice({
        text: "已發佈到討論板。",
        tone: "success",
      });
    } catch (reason) {
      setNotice({
        text: getReadableErrorMessage(reason, "發文失敗，請稍後再試。"),
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePostAction(
    action: "hide" | "remove" | "report",
    postId: string,
  ) {
    setActivePostActionId(`${action}:${postId}`);
    setNotice(null);

    try {
      if (action === "report") {
        await studyFocusApi.reportGroupPost(groupId, postId);
        setNotice({
          text: "已將這則貼文回報給管理端追蹤。",
          tone: "success",
        });
        return;
      }

      if (action === "hide") {
        const hiddenPost = await studyFocusApi.hideGroupPost(groupId, postId);
        setData((current) =>
          current
            ? {
                ...current,
                posts: current.posts.map((post) =>
                  post.id === postId ? hiddenPost : post,
                ),
              }
            : current,
        );
        setNotice({
          text: "這則貼文已被管理員隱藏。",
          tone: "success",
        });
        return;
      }

      await studyFocusApi.removeGroupPost(groupId, postId);
      setData((current) =>
        current
          ? {
              ...current,
              posts: current.posts.filter((post) => post.id !== postId),
            }
          : current,
      );
      setNotice({
        text: "這則貼文已被移除。",
        tone: "success",
      });
    } catch (reason) {
      setNotice({
        text: getReadableErrorMessage(reason, "貼文操作失敗，請稍後再試。"),
        tone: "error",
      });
    } finally {
      setActivePostActionId(null);
    }
  }

  async function handleFlagSession(sessionId: string) {
    setActiveSessionActionId(sessionId);
    setNotice(null);

    try {
      await studyFocusApi.flagStudySession(sessionId);
      setData((current) =>
        current
          ? {
              ...current,
              members: current.members.map((member) =>
                member.activeSessionId === sessionId
                  ? {
                      ...member,
                      activeSessionIntegrityStatus: "flagged",
                    }
                  : member,
              ),
            }
          : current,
      );
      setNotice({
        text: "這筆專注紀錄已標記為待審查。",
        tone: "success",
      });
    } catch (reason) {
      setNotice({
        text: getReadableErrorMessage(reason, "這筆專注紀錄目前無法標記。"),
        tone: "error",
      });
    } finally {
      setActiveSessionActionId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="page">
        <LoadingState label="正在進入小組頁面。" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page">
        {errorStatus === 401 ? (
          <AuthRequiredState description="登入後才能查看小組成員與討論板。" />
        ) : (
          <ErrorState
            title="找不到這個小組"
            description={errorMessage ?? "可能是小組代碼有變，或資料尚未同步。"}
            onRetry={reload}
          />
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
        <EmptyState
          title="小組資料是空的"
          description="請回上一頁重新選擇要查看的小組。"
        />
      </div>
    );
  }

  const studyingMembers = data.members.filter((member) => member.studyingNow);
  const canModerate =
    data.group.viewerRole === "owner" || data.group.viewerRole === "admin";

  return (
    <div className="page stack-lg">
      <PageHeader
        eyebrow="小組詳情"
        title={data.group.name}
        description={`${data.group.className} · 邀請碼 ${data.group.joinCode} · ${data.group.description}`}
        actions={
          <Button variant="secondary" onClick={handleCopyJoinCode}>
            複製邀請碼
          </Button>
        }
      />

      {notice ? <NoticeBanner tone={notice.tone}>{notice.text}</NoticeBanner> : null}

      {data.group.activityHighlight ? (
        <NoticeBanner tone="info">{data.group.activityHighlight}</NoticeBanner>
      ) : null}

      <div className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">在線人數</span>
          <p className="stat-value">{data.stats.liveStudyingCount}</p>
          <span className="meta-text">目前正在讀書的成員</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">今日累積</span>
          <p className="stat-value">{formatMinutes(data.stats.todayTotalMinutes)}</p>
          <span className="meta-text">全組今天已投入的時間</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">本週累積</span>
          <p className="stat-value">{formatMinutes(data.stats.weeklyTotalMinutes)}</p>
          <span className="meta-text">拉長看更容易看出穩定度</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">今天有進度</span>
          <p className="stat-value">{data.stats.activeTodayCount} 人</p>
          <span className="meta-text">{data.stats.momentumLabel}</span>
        </article>
      </div>

      {data.highlights.length > 0 ? (
        <SectionCard
          title="本組亮點"
          description="用最短的資訊看出這組現在的節奏。"
        >
          <div className="section-grid section-grid--3">
            {data.highlights.map((highlight) => (
              <article key={highlight.title} className="stat-card">
                <span className="stat-label">{highlight.title}</span>
                <p className="meta-text">{highlight.description}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <div className="split-grid split-grid--sidebar">
        <SectionCard
          title="正在讀書的人"
          description="看到有人在線，通常更容易一起把進度接上。"
        >
          {studyingMembers.length === 0 ? (
            <EmptyState
              title="現在還沒有人在線"
              description="可以先發一則貼文提醒大家今晚一起讀。"
            />
          ) : (
            <div className="member-list">
              {studyingMembers.map((member) => (
                <article key={member.id} className="member-row">
                  <div className="stack-xs">
                    <strong className="member-name">{member.name}</strong>
                    <span className="member-status">
                      今天 {formatMinutes(member.todayMinutes)}
                      {member.milestoneBadge ? ` · ${member.milestoneBadge}` : ""}
                    </span>
                  </div>
                  <div className="button-row">
                    {canModerate && member.activeSessionId ? (
                      <Button
                        type="button"
                        size="small"
                        variant="ghost"
                        onClick={() => void handleFlagSession(member.activeSessionId!)}
                        disabled={
                          activeSessionActionId === member.activeSessionId ||
                          member.activeSessionIntegrityStatus === "flagged"
                        }
                      >
                        {member.activeSessionIntegrityStatus === "flagged"
                          ? "待審查"
                          : activeSessionActionId === member.activeSessionId
                            ? "標記中..."
                            : "標記審查"}
                      </Button>
                    ) : null}
                    <span className="subject-pill">
                      {member.activeSessionIntegrityStatus === "flagged"
                        ? "待審查"
                        : "專注中"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="全部成員" description="快速確認誰最近最穩。">
          <div className="member-list">
            {data.members.map((member) => (
              <article key={member.id} className="member-row">
                <div className="stack-xs">
                  <strong className="member-name">{member.name}</strong>
                  <span className="meta-text">
                    連續 {member.streakDays} 天 · 今天 {formatMinutes(member.todayMinutes)}
                    {member.milestoneBadge ? ` · ${member.milestoneBadge}` : ""}
                  </span>
                </div>
                <span className="member-status">
                  {member.activeSessionIntegrityStatus === "flagged"
                    ? "待審查"
                    : member.studyingNow
                      ? "專注中"
                      : "休息中"}
                </span>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="討論板"
        description="留下重點、問問題，或提醒大家今晚的讀書節奏。"
      >
        <form className="field-grid" onSubmit={handleSubmitPost}>
          <textarea
            className="textarea"
            placeholder="例如：今晚 8:00 一起寫數學模擬卷，寫完互相對答案。"
            value={postContent}
            onChange={(event) => setPostContent(event.target.value)}
          />

          <div className="button-row">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "送出中..." : "發佈貼文"}
            </Button>
            <span className="meta-text">
              小提醒：留言越具體，越容易把大家拉回同一個節奏。
            </span>
          </div>
        </form>

        {data.posts.length === 0 ? (
          <EmptyState
            title="還沒有貼文"
            description="你可以發第一則，幫這組把今天的節奏帶起來。"
          />
        ) : (
          <div className="post-list">
            {data.posts.map((post) => (
              <article key={post.id} className="post-card">
                <div className="post-card__meta">
                  <strong>{post.authorName}</strong>
                  <span className="meta-text">{formatDateTime(post.createdAt)}</span>
                </div>
                <div className="button-row">
                  <Button
                    type="button"
                    size="small"
                    variant="ghost"
                    onClick={() => void handlePostAction("report", post.id)}
                    disabled={
                      activePostActionId === `report:${post.id}` ||
                      post.status === "hidden"
                    }
                  >
                    {activePostActionId === `report:${post.id}` ? "回報中..." : "回報"}
                  </Button>
                  {canModerate ? (
                    <Button
                      type="button"
                      size="small"
                      variant="ghost"
                      onClick={() => void handlePostAction("hide", post.id)}
                      disabled={
                        activePostActionId === `hide:${post.id}` ||
                        post.status === "hidden"
                      }
                    >
                      {post.status === "hidden"
                        ? "已隱藏"
                        : activePostActionId === `hide:${post.id}`
                          ? "隱藏中..."
                          : "隱藏"}
                    </Button>
                  ) : null}
                  {canModerate ? (
                    <Button
                      type="button"
                      size="small"
                      variant="ghost"
                      onClick={() => void handlePostAction("remove", post.id)}
                      disabled={activePostActionId === `remove:${post.id}`}
                    >
                      {activePostActionId === `remove:${post.id}` ? "移除中..." : "移除"}
                    </Button>
                  ) : null}
                </div>
                <p className="post-card__content">{post.content}</p>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
