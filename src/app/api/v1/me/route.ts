import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError, ok, parseJson } from "@/lib/http";
import { getCurrentProfile, updateCurrentProfile } from "@/lib/services/profiles";
import { updateProfileSchema } from "@/lib/validation/schemas";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext();
    const profile = await getCurrentProfile(context);

    return ok(profile);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireAuthenticatedContext();
    const payload = await parseJson(request, updateProfileSchema);
    const profile = await updateCurrentProfile(context, payload);

    return ok(profile);
  } catch (error) {
    return handleRouteError(error);
  }
}

