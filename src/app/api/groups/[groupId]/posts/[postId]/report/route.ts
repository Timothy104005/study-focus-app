import { NextResponse } from "next/server";

import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError, parseJson } from "@/lib/http";
import { buildRouteErrorLogContext } from "@/lib/observability";
import { reportGroupPostData } from "@/lib/services/study-focus-api-adapter";
import { uuidSchema } from "@/lib/validation/common";
import { reportDiscussionPostSchema } from "@/lib/validation/schemas";

export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string; postId: string }> },
) {
  try {
    const { postId } = await Promise.resolve(context.params);
    const payload = await parseJson(request, reportDiscussionPostSchema);
    const contextAuth = await requireAuthenticatedContext();

    return NextResponse.json(await reportGroupPostData(contextAuth, uuidSchema.parse(postId), payload.reason));
  } catch (error) {
    return handleRouteError(error, buildRouteErrorLogContext("/api/groups/[groupId]/posts/[postId]/report", "POST"));
  }
}
