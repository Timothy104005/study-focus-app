import { requireAuthenticatedContext } from "@/lib/auth";
import { created, handleRouteError, ok, parseJson } from "@/lib/http";
import { buildRouteErrorLogContext } from "@/lib/observability";
import { createDiscussionPost, listDiscussionPosts } from "@/lib/services/discussion-posts";
import { uuidSchema } from "@/lib/validation/common";
import { createDiscussionPostSchema } from "@/lib/validation/schemas";

export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await Promise.resolve(context.params);
    const parsedGroupId = uuidSchema.parse(groupId);
    const authContext = await requireAuthenticatedContext();
    const posts = await listDiscussionPosts(authContext, parsedGroupId);

    return ok(posts);
  } catch (error) {
    return handleRouteError(error, buildRouteErrorLogContext("/api/v1/groups/[groupId]/discussion-posts", "GET"));
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await Promise.resolve(context.params);
    const parsedGroupId = uuidSchema.parse(groupId);
    const authContext = await requireAuthenticatedContext();
    const payload = await parseJson(request, createDiscussionPostSchema);
    const post = await createDiscussionPost(authContext, {
      content: payload.content,
      groupId: parsedGroupId,
    });

    return created(post);
  } catch (error) {
    return handleRouteError(error, buildRouteErrorLogContext("/api/v1/groups/[groupId]/discussion-posts", "POST"));
  }
}
