import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { touchCurrentProfilePresence } from "@/lib/services/profiles";

export async function POST() {
  try {
    const context = await requireAuthenticatedContext();
    const profile = await touchCurrentProfilePresence(context);

    return ok(profile);
  } catch (error) {
    return handleRouteError(error);
  }
}
