import { NextRequest, NextResponse } from "next/server";

import { normalizeAppPath } from "@/lib/navigation";
import { logOpsEvent } from "@/lib/observability";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function deriveDisplayName(email: string | undefined, displayName: unknown) {
  if (typeof displayName === "string" && displayName.trim().length > 0) {
    return displayName.trim();
  }

  return email?.split("@")[0] ?? "student";
}

async function bootstrapProfileFallback(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    logOpsEvent("warn", "auth.callback.profile_bootstrap_user_missing", {
      error: userError?.message ?? null,
    });
    return;
  }

  const { data: existingProfile, error: lookupError } = await supabase
    .from("profiles")
    .select("id, email, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (lookupError) {
    logOpsEvent("error", "auth.callback.profile_bootstrap_lookup_failed", {
      error: lookupError.message,
      userId: user.id,
    });
    return;
  }

  const now = new Date().toISOString();
  const avatarUrl =
    typeof user.user_metadata.avatar_url === "string" && user.user_metadata.avatar_url.trim().length > 0
      ? user.user_metadata.avatar_url.trim()
      : null;

  if (existingProfile) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        avatar_url: avatarUrl ?? existingProfile.avatar_url,
        email: user.email ?? existingProfile.email,
        last_seen_at: now,
      })
      .eq("id", user.id);

    if (updateError) {
      logOpsEvent("error", "auth.callback.profile_bootstrap_update_failed", {
        error: updateError.message,
        userId: user.id,
      });
    }

    return;
  }

  const { error: insertError } = await supabase.from("profiles").insert({
    id: user.id,
    email: user.email ?? "",
    display_name: deriveDisplayName(user.email, user.user_metadata.display_name),
    avatar_url: avatarUrl,
    timezone: "UTC",
    last_seen_at: now,
  });

  if (insertError) {
    logOpsEvent("error", "auth.callback.profile_bootstrap_insert_failed", {
      error: insertError.message,
      userId: user.id,
    });
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = normalizeAppPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?auth=missing-code", requestUrl.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?auth=error", requestUrl.origin));
  }

  const { error: profileTouchError } = await supabase.rpc("touch_profile_presence");

  if (profileTouchError) {
    logOpsEvent("warn", "auth.callback.profile_touch_fallback", {
      error: profileTouchError.message,
    });
    await bootstrapProfileFallback(supabase);
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
