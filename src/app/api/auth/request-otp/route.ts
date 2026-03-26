import { NextResponse } from "next/server";

import { requireSupabaseEnv } from "@/lib/env";
import { ApiError, handleRouteError, parseJson } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requestEmailOtpData } from "@/lib/services/study-focus-api-adapter";
import { authEmailSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const env = requireSupabaseEnv();
    const payload = await parseJson(request, authEmailSchema);
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.auth.signInWithOtp({
      email: payload.email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo:
          payload.mode === "magic_link"
            ? `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(payload.nextPath)}`
            : undefined,
      },
    });

    if (error) {
      throw new ApiError(400, "auth_email_failed", error.message);
    }

    return NextResponse.json(await requestEmailOtpData(payload.email));
  } catch (error) {
    return handleRouteError(error);
  }
}
