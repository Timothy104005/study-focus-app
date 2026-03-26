import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError, ok, parseJson } from "@/lib/http";
import { buildRouteErrorLogContext } from "@/lib/observability";
import { reportDiscussionPost } from "@/lib/services/discussion-posts";
import { uuidSchema } from "@/lib/validation/common";
import { reportDiscussionPostSchema } from "@/lib/validation/schemas";

export async function POST(
  request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const { postId } = await Promise.resolve(context.params);
    const parsedPostId = uuidSchema.parse(postId);
    const authContext = await requireAuthenticatedContext();
    const payload = await parseJson(request, reportDiscussionPostSchema);
    const result = await reportDiscussionPost(authContext, parsedPostId, payload.reason);

    return ok(result);
  } catch (error) {
    return handleRouteError(error, buildRouteErrorLogContext("/api/v1/discussion-posts/[postId]/report", "POST"));
  }
}
