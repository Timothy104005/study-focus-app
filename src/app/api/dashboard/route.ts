import { NextResponse } from "next/server";

import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { getDashboardData } from "@/lib/services/study-focus-api-adapter";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext();
    return NextResponse.json(await getDashboardData(context));
  } catch (error) {
    return handleRouteError(error);
  }
}

