import { NextResponse } from "next/server";

import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError, parseJson } from "@/lib/http";
import { joinGroupData } from "@/lib/services/study-focus-api-adapter";
import { z } from "zod";

const joinGroupApiSchema = z.object({
  joinCode: z.string().trim().min(4).max(32),
});

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext();
    const payload = await parseJson(request, joinGroupApiSchema);
    return NextResponse.json(await joinGroupData(context, payload.joinCode));
  } catch (error) {
    return handleRouteError(error);
  }
}

