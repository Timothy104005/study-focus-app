import type {
  AuthenticatedRequestContext,
} from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { logOpsEvent } from "@/lib/observability";
import {
  assertGroupMember,
  assertGroupModerator,
  getViewerGroupRole,
} from "@/lib/services/access-control";
import { mapDiscussionPost } from "@/lib/services/mappers";
import type { Database } from "@/lib/supabase/database.types";

type DiscussionPostRow = {
  author: {
    avatar_url: string | null;
    display_name: string;
    id: string;
  } | null;
  author_user_id: string;
  content: string;
  created_at: string;
  group_id: string;
  id: string;
  updated_at: string;
};

type DiscussionPostTableRow = Database["public"]["Tables"]["discussion_posts"]["Row"];

const DUPLICATE_POST_WINDOW_MS = 2 * 60 * 1000;
const HIDDEN_DISCUSSION_PREFIX = "[Hidden by moderator]";

const discussionPostSelect =
  "id, group_id, author_user_id, content, created_at, updated_at, author:profiles!discussion_posts_author_user_id_fkey(id, display_name, avatar_url)";

function normalizePostContent(content: string) {
  return content.replace(/\s+/g, " ").trim().toLowerCase();
}

async function getDiscussionPostRecord(
  context: AuthenticatedRequestContext,
  postId: string,
) {
  const { data, error } = await context.supabase
    .from("discussion_posts")
    .select("id, group_id, author_user_id, content, created_at, updated_at")
    .eq("id", postId)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "discussion_lookup_failed", error.message);
  }

  if (!data) {
    throw new ApiError(404, "discussion_not_found", "Discussion post not found.");
  }

  return data as DiscussionPostTableRow;
}

async function getDiscussionPostWithAuthor(
  context: AuthenticatedRequestContext,
  postId: string,
) {
  const { data, error } = await context.supabase
    .from("discussion_posts")
    .select(discussionPostSelect)
    .eq("id", postId)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "discussion_lookup_failed", error.message);
  }

  if (!data) {
    throw new ApiError(404, "discussion_not_found", "Discussion post not found.");
  }

  return data as DiscussionPostRow;
}

async function findRecentDuplicatePost(
  context: AuthenticatedRequestContext,
  input: { content: string; groupId: string },
) {
  const since = new Date(Date.now() - DUPLICATE_POST_WINDOW_MS).toISOString();
  const normalizedContent = normalizePostContent(input.content);
  const { data, error } = await context.supabase
    .from("discussion_posts")
    .select("id, content, created_at")
    .eq("group_id", input.groupId)
    .eq("author_user_id", context.user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    throw new ApiError(500, "discussion_duplicate_check_failed", error.message);
  }

  return (data ?? []).find((post) => normalizePostContent(post.content) === normalizedContent) ?? null;
}

export async function listDiscussionPosts(context: AuthenticatedRequestContext, groupId: string) {
  await assertGroupMember(context, groupId);

  const { data, error } = await context.supabase
    .from("discussion_posts")
    .select(discussionPostSelect)
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new ApiError(500, "discussion_list_failed", error.message);
  }

  return ((data ?? []) as DiscussionPostRow[]).map(mapDiscussionPost);
}

export async function createDiscussionPost(
  context: AuthenticatedRequestContext,
  input: { content: string; groupId: string },
) {
  await assertGroupMember(context, input.groupId);

  const duplicatePost = await findRecentDuplicatePost(context, input);

  if (duplicatePost) {
    logOpsEvent("warn", "discussion_post.duplicate_blocked", {
      actorUserId: context.user.id,
      duplicatePostId: duplicatePost.id,
      groupId: input.groupId,
      reason: "exact_duplicate_within_window",
      windowSeconds: DUPLICATE_POST_WINDOW_MS / 1000,
    });

    throw new ApiError(
      429,
      "discussion_duplicate_post",
      "That looks like a duplicate post. Please wait a bit before posting the same message again.",
      {
        duplicatePostId: duplicatePost.id,
        windowSeconds: DUPLICATE_POST_WINDOW_MS / 1000,
      },
    );
  }

  const { data, error } = await context.supabase
    .from("discussion_posts")
    .insert({
      author_user_id: context.user.id,
      content: input.content,
      group_id: input.groupId,
    })
    .select(discussionPostSelect)
    .single();

  if (error || !data) {
    throw new ApiError(400, "discussion_create_failed", error?.message ?? "Unable to create discussion post.");
  }

  logOpsEvent("info", "discussion_post.created", {
    actorUserId: context.user.id,
    groupId: input.groupId,
    postId: data.id,
  });

  return mapDiscussionPost(data as DiscussionPostRow);
}

export async function updateDiscussionPost(
  context: AuthenticatedRequestContext,
  postId: string,
  input: { content: string },
) {
  const existingPost = await getDiscussionPostRecord(context, postId);

  if (existingPost.author_user_id !== context.user.id) {
    throw new ApiError(403, "discussion_update_forbidden", "You can only edit your own discussion posts.");
  }

  if (existingPost.content.startsWith(HIDDEN_DISCUSSION_PREFIX)) {
    throw new ApiError(409, "discussion_hidden", "Hidden discussion posts cannot be edited.");
  }

  const { data, error } = await context.supabase
    .from("discussion_posts")
    .update({
      content: input.content,
    })
    .eq("id", postId)
    .eq("author_user_id", context.user.id)
    .select(discussionPostSelect)
    .single();

  if (error || !data) {
    throw new ApiError(404, "discussion_update_failed", error?.message ?? "Unable to update discussion post.");
  }

  logOpsEvent("info", "discussion_post.updated", {
    actorUserId: context.user.id,
    groupId: existingPost.group_id,
    postId,
  });

  return mapDiscussionPost(data as DiscussionPostRow);
}

export async function reportDiscussionPost(
  context: AuthenticatedRequestContext,
  postId: string,
  reason?: string,
) {
  const post = await getDiscussionPostRecord(context, postId);
  const reporterRole = await assertGroupMember(context, post.group_id);

  if (post.author_user_id === context.user.id) {
    throw new ApiError(400, "discussion_self_report_not_allowed", "You cannot report your own discussion post.");
  }

  logOpsEvent("warn", "discussion_post.reported", {
    actorUserId: context.user.id,
    authorUserId: post.author_user_id,
    groupId: post.group_id,
    postId,
    reason: reason ?? null,
    reporterRole,
  });

  return {
    id: postId,
    processedAt: new Date().toISOString(),
    reason: reason ?? null,
    status: "reported" as const,
  };
}

export async function hideDiscussionPost(
  context: AuthenticatedRequestContext,
  postId: string,
  reason?: string,
) {
  const post = await getDiscussionPostRecord(context, postId);
  const moderatorRole = await assertGroupModerator(context, post.group_id);

  const { data, error } = await context.supabase.rpc("hide_discussion_post", {
    p_post_id: postId,
    p_reason: reason ?? null,
  });

  if (error || !data) {
    throw new ApiError(400, "discussion_hide_failed", error?.message ?? "Unable to hide discussion post.");
  }

  logOpsEvent("warn", "discussion_post.hidden", {
    actorUserId: context.user.id,
    authorUserId: post.author_user_id,
    groupId: post.group_id,
    moderatorRole,
    postId,
    reason: reason ?? null,
  });

  return mapDiscussionPost(await getDiscussionPostWithAuthor(context, postId));
}

export async function deleteDiscussionPost(context: AuthenticatedRequestContext, postId: string) {
  const post = await getDiscussionPostRecord(context, postId);
  const viewerRole = await getViewerGroupRole(context, post.group_id);
  const isModerator = viewerRole === "owner" || viewerRole === "admin";

  if (post.author_user_id !== context.user.id && !isModerator) {
    throw new ApiError(403, "discussion_delete_forbidden", "Only the author or a group moderator can remove this post.");
  }

  const { data, error } = await context.supabase.rpc("delete_discussion_post", {
    p_post_id: postId,
  });

  if (error || data !== postId) {
    throw new ApiError(400, "discussion_delete_failed", error?.message ?? "Unable to remove the discussion post.");
  }

  logOpsEvent("warn", "discussion_post.removed", {
    actorUserId: context.user.id,
    authorUserId: post.author_user_id,
    groupId: post.group_id,
    performedByModerator: post.author_user_id !== context.user.id,
    postId,
    viewerRole: viewerRole ?? null,
  });

  return { id: postId };
}
