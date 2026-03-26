import type { ClassGroupDto, GroupPresenceSummaryDto } from "@/contracts";
import type { AuthenticatedRequestContext } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { buildGroupPresenceChannel } from "@/lib/realtime/presence";
import { mapGroup, mapGroupMember, mapPresenceMember } from "@/lib/services/mappers";
import type { Database } from "@/lib/supabase/database.types";

type ClassGroupRow = Database["public"]["Tables"]["class_groups"]["Row"];
type GroupMemberRow = Database["public"]["Tables"]["group_members"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

async function getCurrentlyStudyingCount(context: AuthenticatedRequestContext, groupId: string) {
  const { data, error } = await context.supabase.rpc("get_group_currently_studying_count", {
    p_group_id: groupId,
  });

  if (error) {
    throw new ApiError(500, "group_presence_failed", error.message);
  }

  return typeof data === "number" ? data : 0;
}

export async function listGroups(context: AuthenticatedRequestContext): Promise<ClassGroupDto[]> {
  const { data, error } = await context.supabase
    .from("group_members")
    .select("group_id, role, group:class_groups!group_members_group_id_fkey(*)")
    .eq("user_id", context.user.id);

  if (error) {
    throw new ApiError(500, "group_list_failed", error.message);
  }

  const memberships = (data ?? []) as Array<{
    group: ClassGroupRow | null;
    group_id: string;
    role: Database["public"]["Enums"]["group_member_role"];
  }>;

  const groupIds = memberships.map((membership) => membership.group_id);
  const countMap = new Map<string, number>();

  if (groupIds.length > 0) {
    const { data: activeSessions, error: activeSessionsError } = await context.supabase
      .from("study_sessions")
      .select("group_id")
      .eq("status", "active")
      .in("group_id", groupIds);

    if (activeSessionsError) {
      throw new ApiError(500, "group_count_failed", activeSessionsError.message);
    }

    for (const row of activeSessions ?? []) {
      countMap.set(row.group_id, (countMap.get(row.group_id) ?? 0) + 1);
    }
  }

  return memberships
    .filter((membership) => membership.group)
    .map((membership) =>
      mapGroup(membership.group as ClassGroupRow, countMap.get(membership.group_id) ?? 0, membership.role),
    );
}

export async function getGroup(context: AuthenticatedRequestContext, groupId: string): Promise<ClassGroupDto> {
  const [{ data: group, error: groupError }, { data: memberships, error: membershipsError }] = await Promise.all([
    context.supabase.from("class_groups").select("*").eq("id", groupId).single(),
    context.supabase
      .from("group_members")
      .select("user_id, role, joined_at, profile:profiles!group_members_user_id_fkey(*)")
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true }),
  ]);

  if (groupError || !group) {
    throw new ApiError(404, "group_not_found", groupError?.message ?? "Group not found.");
  }

  if (membershipsError) {
    throw new ApiError(500, "group_members_failed", membershipsError.message);
  }

  const memberRows = (memberships ?? []) as Array<
    Pick<GroupMemberRow, "user_id" | "role" | "joined_at"> & { profile: ProfileRow | null }
  >;

  const viewerMembership = memberRows.find((member) => member.user_id === context.user.id);

  if (!viewerMembership) {
    throw new ApiError(403, "group_forbidden", "You must belong to this group to view it.");
  }

  const currentlyStudyingCount = await getCurrentlyStudyingCount(context, groupId);

  return {
    ...mapGroup(group as ClassGroupRow, currentlyStudyingCount, viewerMembership.role),
    members: memberRows.map(mapGroupMember),
    presenceChannel: buildGroupPresenceChannel(groupId),
  };
}

export async function createGroup(
  context: AuthenticatedRequestContext,
  input: { description: string | null; name: string },
) {
  const { data, error } = await context.supabase.rpc("create_class_group", {
    p_description: input.description,
    p_name: input.name,
  });

  if (error || !data) {
    throw new ApiError(400, "group_create_failed", error?.message ?? "Unable to create class group.");
  }

  return getGroup(context, (data as ClassGroupRow).id);
}

export async function joinGroupByInviteCode(context: AuthenticatedRequestContext, inviteCode: string) {
  const { data, error } = await context.supabase.rpc("join_group_by_invite", {
    p_invite_code: inviteCode,
  });

  if (error || !data) {
    throw new ApiError(400, "group_join_failed", error?.message ?? "Unable to join group.");
  }

  return getGroup(context, (data as GroupMemberRow).group_id);
}

export async function getGroupPresenceSnapshot(
  context: AuthenticatedRequestContext,
  groupId: string,
): Promise<GroupPresenceSummaryDto> {
  const [{ data, error }, currentlyStudyingCount] = await Promise.all([
    context.supabase.rpc("get_group_presence_snapshot", { p_group_id: groupId }),
    getCurrentlyStudyingCount(context, groupId),
  ]);

  if (error) {
    throw new ApiError(500, "group_presence_snapshot_failed", error.message);
  }

  const rows = (data ?? []) as Array<{
    active_session_id: string | null;
    avatar_url: string | null;
    display_name: string;
    last_seen_at: string | null;
    status: string;
    user_id: string;
  }>;

  return {
    groupId,
    channel: buildGroupPresenceChannel(groupId),
    currentlyStudyingCount,
    members: rows.map(mapPresenceMember),
    generatedAt: new Date().toISOString(),
  };
}

