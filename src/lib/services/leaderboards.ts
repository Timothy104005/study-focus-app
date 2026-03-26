import type { LeaderboardResponseDto } from "@/contracts";
import type { AuthenticatedRequestContext } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { mapLeaderboardEntry } from "@/lib/services/mappers";
import { ensureCurrentProfile } from "@/lib/services/profiles";
import type { Database } from "@/lib/supabase/database.types";

export async function getGroupLeaderboard(
  context: AuthenticatedRequestContext,
  groupId: string,
  input: { range: "daily" | "weekly"; timezone?: string },
): Promise<LeaderboardResponseDto> {
  const profile = await ensureCurrentProfile(context);
  const timezone = input.timezone ?? profile.timezone ?? "UTC";

  const [{ data, error }, { data: currentCount, error: countError }] = await Promise.all([
    context.supabase.rpc("get_group_leaderboard", {
      p_group_id: groupId,
      p_range: input.range,
      p_timezone: timezone,
    }),
    context.supabase.rpc("get_group_currently_studying_count", {
      p_group_id: groupId,
    }),
  ]);

  if (error) {
    throw new ApiError(400, "leaderboard_failed", error.message);
  }

  if (countError) {
    throw new ApiError(500, "leaderboard_count_failed", countError.message);
  }

  const rows = (data ?? []) as Database["public"]["Functions"]["get_group_leaderboard"]["Returns"];
  const generatedAt = new Date().toISOString();

  return {
    groupId,
    range: input.range,
    timezone,
    windowStart: rows[0]?.window_start ?? generatedAt,
    windowEnd: rows[0]?.window_end ?? generatedAt,
    currentlyStudyingCount: typeof currentCount === "number" ? currentCount : 0,
    entries: rows.map(mapLeaderboardEntry),
    generatedAt,
  };
}

