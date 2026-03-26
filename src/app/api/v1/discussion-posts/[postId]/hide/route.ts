import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError, ok, parseJson } from "@/lib/http";
import { buildRouteErrorLogContext } from "@/lib/observability";
import { hideDiscussionPost } from "@/lib/services/discussion-posts";
import { uuidSchema } from "@/lib/validation/common";
import { hideDiscussionPostSchema } from "@/lib/validation/schemas";

export async function POST(
  request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const { postId } = await Promise.resolve(context.params);
    const parsedPostId = uuidSchema.parse(postId);
    const authContext = await requireAuthenticatedContext();
    const payload = await parseJson(request, hideDiscussionPostSchema);
    const result = await hideDiscussionPost(authContext, parsedPostId, payload.reason);

    return ok(result);
  } catch (error) {
    return handleRouteError(error, buildRouteErrorLogContext("/api/v1/discussion-posts/[postId]/hide", "POST"));
  }
}
