import { NextResponse } from "next/server";

import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError, parseJson } from "@/lib/http";
import { buildRouteErrorLogContext } from "@/lib/observability";
import { createGroupPostData } from "@/lib/services/study-focus-api-adapter";
import { uuidSchema } from "@/lib/validation/common";
import { z } from "zod";

const createPostApiSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await Promise.resolve(context.params);
    const payload = await parseJson(request, createPostApiSchema);
    const contextAuth = await requireAuthenticatedContext();
    return NextResponse.json(await createGroupPostData(contextAuth, uuidSchema.parse(groupId), payload));
  } catch (error) {
    return handleRouteError(error, buildRouteErrorLogContext("/api/groups/[groupId]/posts", "POST"));
  }
}
