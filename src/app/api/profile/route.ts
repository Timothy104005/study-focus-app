import { NextResponse } from "next/server";

import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { getProfileStatsData } from "@/lib/services/study-focus-api-adapter";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext();
    return NextResponse.json(await getProfileStatsData(context));
  } catch (error) {
    return handleRouteError(error);
  }
}
