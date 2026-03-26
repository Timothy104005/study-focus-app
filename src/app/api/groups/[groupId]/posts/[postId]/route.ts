import { NextResponse } from "next/server";

import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { buildRouteErrorLogContext } from "@/lib/observability";
import { removeGroupPostData } from "@/lib/services/study-focus-api-adapter";
import { uuidSchema } from "@/lib/validation/common";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ groupId: string; postId: string }> },
) {
  try {
    const { postId } = await Promise.resolve(context.params);
    const contextAuth = await requireAuthenticatedContext();

    return NextResponse.json(await removeGroupPostData(contextAuth, uuidSchema.parse(postId)));
  } catch (error) {
    return handleRouteError(error, buildRouteErrorLogContext("/api/groups/[groupId]/posts/[postId]", "DELETE"));
  }
}
