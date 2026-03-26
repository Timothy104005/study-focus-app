import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { buildRouteErrorLogContext } from "@/lib/observability";
import { stopStudySession } from "@/lib/services/study-sessions";
import { uuidSchema } from "@/lib/validation/common";

export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await Promise.resolve(context.params);
    const parsedSessionId = uuidSchema.parse(sessionId);
    const authContext = await requireAuthenticatedContext();
    const session = await stopStudySession(authContext, parsedSessionId);

    return ok(session);
  } catch (error) {
    return handleRouteError(error, buildRouteErrorLogContext("/api/v1/study-sessions/[sessionId]/stop", "POST"));
  }
}
