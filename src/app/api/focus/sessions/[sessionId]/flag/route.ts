import { NextResponse } from "next/server";

import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError, parseJson } from "@/lib/http";
import { buildRouteErrorLogContext } from "@/lib/observability";
import { flagStudySessionForReviewData } from "@/lib/services/study-focus-api-adapter";
import { uuidSchema } from "@/lib/validation/common";
import { flagStudySessionSchema } from "@/lib/validation/schemas";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await Promise.resolve(context.params);
    const payload = await parseJson(request, flagStudySessionSchema);
    const contextAuth = await requireAuthenticatedContext();

    return NextResponse.json(
      await flagStudySessionForReviewData(contextAuth, uuidSchema.parse(sessionId), payload.reason),
    );
  } catch (error) {
    return handleRouteError(error, buildRouteErrorLogContext("/api/focus/sessions/[sessionId]/flag", "POST"));
  }
}
