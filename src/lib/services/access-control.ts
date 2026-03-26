import type { AuthenticatedRequestContext } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import type { Database } from "@/lib/supabase/database.types";

type GroupMemberRole = Database["public"]["Enums"]["group_member_role"];

export async function getViewerGroupRole(
  context: AuthenticatedRequestContext,
  groupId: string,
): Promise<GroupMemberRole | null> {
  const { data, error } = await context.supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "group_membership_lookup_failed", error.message);
  }

  return data?.role ?? null;
}

export async function assertGroupMember(
  context: AuthenticatedRequestContext,
  groupId: string,
): Promise<GroupMemberRole> {
  const role = await getViewerGroupRole(context, groupId);

  if (!role) {
    throw new ApiError(403, "group_forbidden", "You must belong to this group to perform this action.");
  }

  return role;
}

export async function assertGroupModerator(
  context: AuthenticatedRequestContext,
  groupId: string,
): Promise<GroupMemberRole> {
  const role = await assertGroupMember(context, groupId);

  if (role !== "owner" && role !== "admin") {
    throw new ApiError(403, "moderator_required", "Only group owners or admins can perform this action.");
  }

  return role;
}
