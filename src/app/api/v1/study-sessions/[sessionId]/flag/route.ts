import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError, ok, parseJson } from "@/lib/http";
import { buildRouteErrorLogContext } from "@/lib/observability";
import { flagStudySessionForReview } from "@/lib/services/study-sessions";
import { uuidSchema } from "@/lib/validation/common";
import { flagStudySessionSchema } from "@/lib/validation/schemas";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await Promise.resolve(context.params);
    const parsedSessionId = uuidSchema.parse(sessionId);
    const authContext = await requireAuthenticatedContext();
    const payload = await parseJson(request, flagStudySessionSchema);
    const session = await flagStudySessionForReview(authContext, parsedSessionId, payload.reason);

    return ok(session);
  } catch (error) {
    return handleRouteError(error, buildRouteErrorLogContext("/api/v1/study-sessions/[sessionId]/flag", "POST"));
  }
}
