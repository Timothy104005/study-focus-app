import { NextResponse } from "next/server";

import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { getGroupDetailData } from "@/lib/services/study-focus-api-adapter";
import { uuidSchema } from "@/lib/validation/common";

export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await Promise.resolve(context.params);
    const contextAuth = await requireAuthenticatedContext();
    return NextResponse.json(await getGroupDetailData(contextAuth, uuidSchema.parse(groupId)));
  } catch (error) {
    return handleRouteError(error);
  }
}
