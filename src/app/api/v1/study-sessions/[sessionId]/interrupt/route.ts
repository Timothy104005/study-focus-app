import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError, ok, parseJson } from "@/lib/http";
import { buildRouteErrorLogContext } from "@/lib/observability";
import { reportStudySessionInterruption } from "@/lib/services/study-sessions";
import { uuidSchema } from "@/lib/validation/common";
import { interruptionSchema } from "@/lib/validation/schemas";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await Promise.resolve(context.params);
    const parsedSessionId = uuidSchema.parse(sessionId);
    const authContext = await requireAuthenticatedContext();
    const payload = await parseJson(request, interruptionSchema);
    const session = await reportStudySessionInterruption(
      authContext,
      parsedSessionId,
      payload.reason ?? "tab_hidden",
    );

    return ok(session);
  } catch (error) {
    return handleRouteError(error, buildRouteErrorLogContext("/api/v1/study-sessions/[sessionId]/interrupt", "POST"));
  }
}
