import { redirect } from "next/navigation";

import { AppShellLayoutClient } from "@/app/(shell)/app-shell-layout-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  return <AppShellLayoutClient>{children}</AppShellLayoutClient>;
}
