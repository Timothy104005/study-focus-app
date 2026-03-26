import { NextRequest } from "next/server";

import { requireAuthenticatedContext } from "@/lib/auth";
import { created, handleRouteError, ok, parseJson } from "@/lib/http";
import { buildRouteErrorLogContext } from "@/lib/observability";
import { createStudySession, listStudySessions } from "@/lib/services/study-sessions";
import { createStudySessionSchema, studySessionQuerySchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  try {
    const query = studySessionQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const authContext = await requireAuthenticatedContext();
    const sessions = await listStudySessions(authContext, query);

    return ok(sessions);
  } catch (error) {
    return handleRouteError(
      error,
      buildRouteErrorLogContext("/api/v1/study-sessions", "GET", {
        details: { searchParams: Object.fromEntries(request.nextUrl.searchParams.entries()) },
      }),
    );
  }
}

export async function POST(request: Request) {
  try {
    const authContext = await requireAuthenticatedContext();
    const payload = await parseJson(request, createStudySessionSchema);
    const session = await createStudySession(authContext, {
      groupId: payload.groupId,
      title: payload.title,
      notes: payload.notes ?? null,
    });

    return created(session);
  } catch (error) {
    return handleRouteError(error, buildRouteErrorLogContext("/api/v1/study-sessions", "POST"));
  }
}
