import { NextRequest } from "next/server";

import { requireAuthenticatedContext } from "@/lib/auth";
import { created, handleRouteError, ok, parseJson } from "@/lib/http";
import { createExamCountdown, listExamCountdowns } from "@/lib/services/exam-countdowns";
import { createExamCountdownSchema, examCountdownQuerySchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuthenticatedContext();
    const query = examCountdownQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const countdowns = await listExamCountdowns(authContext, query);

    return ok(countdowns);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const authContext = await requireAuthenticatedContext();
    const payload = await parseJson(request, createExamCountdownSchema);
    const countdown = await createExamCountdown(authContext, {
      title: payload.title,
      examAt: payload.examAt,
      groupId: payload.groupId ?? null,
      subject: payload.subject ?? null,
      notes: payload.notes ?? null,
    });

    return created(countdown);
  } catch (error) {
    return handleRouteError(error);
  }
}
