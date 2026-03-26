import { NextResponse } from "next/server";

import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError, parseJson } from "@/lib/http";
import { createExamData, getExamsData } from "@/lib/services/study-focus-api-adapter";
import { z } from "zod";

const createExamApiSchema = z.object({
  title: z.string().trim().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  subjectScope: z.string().trim().min(1).max(120),
});

export async function GET() {
  try {
    const context = await requireAuthenticatedContext();
    return NextResponse.json(await getExamsData(context));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext();
    const payload = await parseJson(request, createExamApiSchema);
    return NextResponse.json(await createExamData(context, payload));
  } catch (error) {
    return handleRouteError(error);
  }
}

