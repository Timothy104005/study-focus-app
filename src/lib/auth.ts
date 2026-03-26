import type { User } from "@supabase/supabase-js";

import { ApiError } from "@/lib/http";
import { createSupabaseServerClient, type AppSupabaseClient } from "@/lib/supabase/server";

export interface AuthenticatedRequestContext {
  supabase: AppSupabaseClient;
  user: User;
}

export async function requireAuthenticatedContext(): Promise<AuthenticatedRequestContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ApiError(401, "unauthorized", "You must be signed in to use this endpoint.");
  }

  return { supabase, user };
}
