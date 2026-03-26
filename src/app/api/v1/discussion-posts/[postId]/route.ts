import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError, ok, parseJson } from "@/lib/http";
import { buildRouteErrorLogContext } from "@/lib/observability";
import { deleteDiscussionPost, updateDiscussionPost } from "@/lib/services/discussion-posts";
import { uuidSchema } from "@/lib/validation/common";
import { updateDiscussionPostSchema } from "@/lib/validation/schemas";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const { postId } = await Promise.resolve(context.params);
    const parsedPostId = uuidSchema.parse(postId);
    const authContext = await requireAuthenticatedContext();
    const payload = await parseJson(request, updateDiscussionPostSchema);
    const post = await updateDiscussionPost(authContext, parsedPostId, payload);

    return ok(post);
  } catch (error) {
    return handleRouteError(error, buildRouteErrorLogContext("/api/v1/discussion-posts/[postId]", "PATCH"));
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const { postId } = await Promise.resolve(context.params);
    const parsedPostId = uuidSchema.parse(postId);
    const authContext = await requireAuthenticatedContext();
    const deleted = await deleteDiscussionPost(authContext, parsedPostId);

    return ok(deleted);
  } catch (error) {
    return handleRouteError(error, buildRouteErrorLogContext("/api/v1/discussion-posts/[postId]", "DELETE"));
  }
}
