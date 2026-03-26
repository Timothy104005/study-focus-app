import type { AuthenticatedRequestContext } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { assertGroupMember } from "@/lib/services/access-control";
import { mapExamCountdown } from "@/lib/services/mappers";
import type { Database } from "@/lib/supabase/database.types";

type CountdownRow = Database["public"]["Tables"]["exam_countdowns"]["Row"];

async function getJoinedGroupIds(context: AuthenticatedRequestContext) {
  const { data, error } = await context.supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", context.user.id);

  if (error) {
    throw new ApiError(500, "countdown_group_lookup_failed", error.message);
  }

  return (data ?? []).map((row) => row.group_id);
}

async function getOwnedExamCountdownRow(
  context: AuthenticatedRequestContext,
  countdownId: string,
) {
  const { data, error } = await context.supabase
    .from("exam_countdowns")
    .select("*")
    .eq("id", countdownId)
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "countdown_lookup_failed", error.message);
  }

  if (!data) {
    throw new ApiError(
      404,
      "countdown_not_found",
      "Exam countdown not found or you do not own it.",
    );
  }

  return data as CountdownRow;
}

export async function listExamCountdowns(
  context: AuthenticatedRequestContext,
  filters: { groupId?: string },
) {
  if (filters.groupId) {
    await assertGroupMember(context, filters.groupId);

    const { data, error } = await context.supabase
      .from("exam_countdowns")
      .select("*")
      .eq("group_id", filters.groupId)
      .order("exam_at", { ascending: true });

    if (error) {
      throw new ApiError(500, "countdown_list_failed", error.message);
    }

    return (data ?? []).map((row) => mapExamCountdown(row as CountdownRow));
  }

  const joinedGroupIds = await getJoinedGroupIds(context);
  const [{ data: personalCountdowns, error: personalError }, groupResult] = await Promise.all([
    context.supabase
      .from("exam_countdowns")
      .select("*")
      .eq("user_id", context.user.id)
      .order("exam_at", { ascending: true }),
    joinedGroupIds.length > 0
      ? context.supabase
          .from("exam_countdowns")
          .select("*")
          .in("group_id", joinedGroupIds)
          .order("exam_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (personalError) {
    throw new ApiError(500, "countdown_list_failed", personalError.message);
  }

  if (groupResult.error) {
    throw new ApiError(500, "countdown_group_list_failed", groupResult.error.message);
  }

  const merged = new Map<string, CountdownRow>();

  for (const row of (personalCountdowns ?? []) as CountdownRow[]) {
    merged.set(row.id, row);
  }

  for (const row of (groupResult.data ?? []) as CountdownRow[]) {
    merged.set(row.id, row);
  }

  return Array.from(merged.values())
    .sort((left, right) => left.exam_at.localeCompare(right.exam_at))
    .map(mapExamCountdown);
}

export async function createExamCountdown(
  context: AuthenticatedRequestContext,
  input: {
    examAt: string;
    groupId: string | null;
    notes: string | null;
    subject: string | null;
    title: string;
  },
) {
  if (input.groupId) {
    await assertGroupMember(context, input.groupId);
  }

  const { data, error } = await context.supabase
    .from("exam_countdowns")
    .insert({
      exam_at: input.examAt,
      group_id: input.groupId,
      notes: input.notes,
      subject: input.subject,
      title: input.title,
      user_id: context.user.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new ApiError(400, "countdown_create_failed", error?.message ?? "Unable to create exam countdown.");
  }

  return mapExamCountdown(data as CountdownRow);
}

export async function getExamCountdown(context: AuthenticatedRequestContext, countdownId: string) {
  const { data, error } = await context.supabase
    .from("exam_countdowns")
    .select("*")
    .eq("id", countdownId)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "countdown_lookup_failed", error.message);
  }

  if (!data) {
    throw new ApiError(404, "countdown_not_found", "Exam countdown not found.");
  }

  return mapExamCountdown(data as CountdownRow);
}

export async function updateExamCountdown(
  context: AuthenticatedRequestContext,
  countdownId: string,
  input: {
    examAt?: string;
    groupId?: string | null;
    notes?: string | null;
    subject?: string | null;
    title?: string;
  },
) {
  await getOwnedExamCountdownRow(context, countdownId);

  if (input.groupId) {
    await assertGroupMember(context, input.groupId);
  }

  const updates: Database["public"]["Tables"]["exam_countdowns"]["Update"] = {};

  if (input.examAt !== undefined) {
    updates.exam_at = input.examAt;
  }

  if (input.groupId !== undefined) {
    updates.group_id = input.groupId;
  }

  if (input.notes !== undefined) {
    updates.notes = input.notes;
  }

  if (input.subject !== undefined) {
    updates.subject = input.subject;
  }

  if (input.title !== undefined) {
    updates.title = input.title;
  }

  const { data, error } = await context.supabase
    .from("exam_countdowns")
    .update(updates)
    .eq("id", countdownId)
    .eq("user_id", context.user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new ApiError(400, "countdown_update_failed", error?.message ?? "Unable to update exam countdown.");
  }

  return mapExamCountdown(data as CountdownRow);
}

export async function deleteExamCountdown(context: AuthenticatedRequestContext, countdownId: string) {
  await getOwnedExamCountdownRow(context, countdownId);

  const { error } = await context.supabase
    .from("exam_countdowns")
    .delete()
    .eq("id", countdownId)
    .eq("user_id", context.user.id);

  if (error) {
    throw new ApiError(400, "countdown_delete_failed", error.message);
  }

  return { id: countdownId };
}
