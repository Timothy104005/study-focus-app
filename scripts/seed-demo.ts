import { createClient } from "@supabase/supabase-js";
import { env, requireSupabaseEnv } from "../src/lib/env";
import type { Database } from "../src/lib/supabase/database.types";

const demoUser = {
  email: "demo@studyfocus.tw",
  password: "demo1234",
  displayName: "Demo Student",
};

async function main() {
  const supabaseEnv = requireSupabaseEnv();

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to seed demo user.");
  }

  const supabase = createClient<Database>(
    supabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const { data: listedUsers, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 500,
  });

  if (listError) {
    throw listError;
  }

  const existingUser = listedUsers.users.find(
    (user) => user.email?.toLowerCase() === demoUser.email,
  );

  let userId = existingUser?.id;

  if (!existingUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: demoUser.email,
      password: demoUser.password,
      email_confirm: true,
      user_metadata: {
        display_name: demoUser.displayName,
      },
    });

    if (error || !data.user) {
      throw error ?? new Error("Unable to create demo user.");
    }

    userId = data.user.id;
  } else {
    const { error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: demoUser.password,
      email_confirm: true,
      user_metadata: {
        display_name: demoUser.displayName,
      },
    });

    if (error) {
      throw error;
    }
  }

  if (!userId) {
    throw new Error("Demo user id is missing.");
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: demoUser.email,
      display_name: demoUser.displayName,
      timezone: "Asia/Taipei",
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (profileError) {
    throw profileError;
  }

  console.log(`Demo user seeded: ${demoUser.email}`);
}

main().catch((error) => {
  console.error("Failed to seed demo user", error);
  process.exitCode = 1;
});
