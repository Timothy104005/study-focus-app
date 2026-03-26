import { NextResponse } from "next/server";

import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError, parseJson } from "@/lib/http";
import { buildRouteErrorLogContext } from "@/lib/observability";
import { createFocusSessionData } from "@/lib/services/study-focus-api-adapter";
import { z } from "zod";

const createFocusSessionApiSchema = z.object({
  subjectId: z.string().trim().min(1).max(120),
  note: z.string().trim().max(500).optional(),
  durationMinutes: z.number().int().min(1).max(24 * 60),
  interrupted: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext();
    const payload = await parseJson(request, createFocusSessionApiSchema);
    return NextResponse.json(await createFocusSessionData(context, payload));
  } catch (error) {
    return handleRouteError(error, buildRouteErrorLogContext("/api/focus/sessions", "POST"));
  }
}
