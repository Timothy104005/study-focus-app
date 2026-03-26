import { NextRequest } from "next/server";

import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { getGroupLeaderboard } from "@/lib/services/leaderboards";
import { uuidSchema } from "@/lib/validation/common";
import { leaderboardQuerySchema } from "@/lib/validation/schemas";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await Promise.resolve(context.params);
    const parsedGroupId = uuidSchema.parse(groupId);
    const query = leaderboardQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const authContext = await requireAuthenticatedContext();
    const leaderboard = await getGroupLeaderboard(authContext, parsedGroupId, query);

    return ok(leaderboard);
  } catch (error) {
    return handleRouteError(error);
  }
}
