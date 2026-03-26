import type { AuthenticatedRequestContext } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { mapProfile } from "@/lib/services/mappers";
import type { Database } from "@/lib/supabase/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function deriveDisplayName(context: AuthenticatedRequestContext) {
  const metadataName = context.user.user_metadata.display_name;

  if (typeof metadataName === "string" && metadataName.trim().length > 0) {
    return metadataName.trim();
  }

  return context.user.email?.split("@")[0] ?? "student";
}

export async function ensureCurrentProfile(context: AuthenticatedRequestContext) {
  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await context.supabase
    .from("profiles")
    .select("*")
    .eq("id", context.user.id)
    .maybeSingle();

  if (existingError) {
    throw new ApiError(500, "profile_lookup_failed", existingError.message);
  }

  if (existing) {
    const { data, error } = await context.supabase
      .from("profiles")
      .update({
        email: context.user.email ?? existing.email,
        last_seen_at: now,
      })
      .eq("id", context.user.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new ApiError(
        500,
        "profile_touch_failed",
        error?.message ?? "Unable to refresh the current profile presence.",
      );
    }

    return mapProfile(data as ProfileRow);
  }

  const payload: Database["public"]["Tables"]["profiles"]["Insert"] = {
    id: context.user.id,
    email: context.user.email ?? "",
    display_name: deriveDisplayName(context),
    avatar_url:
      typeof context.user.user_metadata.avatar_url === "string" ? context.user.user_metadata.avatar_url : null,
    timezone: "UTC",
    last_seen_at: now,
  };

  const { data, error } = await context.supabase
    .from("profiles")
    .insert(payload)
    .select("*")
    .single();

  if (error?.code === "23505") {
    const { data: refreshed, error: refreshedError } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.user.id)
      .single();

    if (refreshedError || !refreshed) {
      throw new ApiError(
        500,
        "profile_race_recovery_failed",
        refreshedError?.message ?? "Unable to recover the profile after a concurrent insert.",
      );
    }

    return mapProfile(refreshed as ProfileRow);
  }

  if (error || !data) {
    throw new ApiError(500, "profile_insert_failed", error?.message ?? "Unable to create the current profile.");
  }

  return mapProfile(data as ProfileRow);
}

export async function getCurrentProfile(context: AuthenticatedRequestContext) {
  return ensureCurrentProfile(context);
}

export async function updateCurrentProfile(
  context: AuthenticatedRequestContext,
  input: {
    avatarUrl?: string | null;
    displayName?: string;
    timezone?: string;
  },
) {
  await ensureCurrentProfile(context);

  const updates: Database["public"]["Tables"]["profiles"]["Update"] = {
    last_seen_at: new Date().toISOString(),
  };

  if (input.displayName !== undefined) {
    updates.display_name = input.displayName;
  }

  if (input.avatarUrl !== undefined) {
    updates.avatar_url = input.avatarUrl;
  }

  if (input.timezone !== undefined) {
    updates.timezone = input.timezone;
  }

  const { data, error } = await context.supabase
    .from("profiles")
    .update(updates)
    .eq("id", context.user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new ApiError(500, "profile_update_failed", error?.message ?? "Unable to update the current profile.");
  }

  return mapProfile(data as ProfileRow);
}

export async function touchCurrentProfilePresence(context: AuthenticatedRequestContext) {
  const { data, error } = await context.supabase.rpc("touch_profile_presence");

  if (error || !data) {
    throw new ApiError(500, "presence_touch_failed", error?.message ?? "Unable to update presence heartbeat.");
  }

  return mapProfile(data as ProfileRow);
}
