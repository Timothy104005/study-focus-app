import { NextResponse } from "next/server";

import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError, parseJson } from "@/lib/http";
import { createGroupData, getGroupsData } from "@/lib/services/study-focus-api-adapter";
import { z } from "zod";

const createGroupApiSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(1).max(240),
  className: z.string().trim().min(1).max(80),
});

export async function GET() {
  try {
    const context = await requireAuthenticatedContext();
    return NextResponse.json(await getGroupsData(context));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext();
    const payload = await parseJson(request, createGroupApiSchema);
    return NextResponse.json(await createGroupData(context, payload));
  } catch (error) {
    return handleRouteError(error);
  }
}

