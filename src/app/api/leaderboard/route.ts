import { NextRequest, NextResponse } from "next/server";

import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { getLeaderboardData } from "@/lib/services/study-focus-api-adapter";

export async function GET(request: NextRequest) {
  try {
    const context = await requireAuthenticatedContext();
    const classId = request.nextUrl.searchParams.get("classId") ?? undefined;
    return NextResponse.json(await getLeaderboardData(context, classId));
  } catch (error) {
    return handleRouteError(error);
  }
}

