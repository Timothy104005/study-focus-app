"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { AppSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export function createSupabaseBrowserClient(): AppSupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing public Supabase environment variables.");
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey) as unknown as AppSupabaseClient;
}
