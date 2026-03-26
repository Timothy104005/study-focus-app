import { requireAuthenticatedContext } from "@/lib/auth";
import { created, handleRouteError, parseJson } from "@/lib/http";
import { joinGroupByInviteCode } from "@/lib/services/groups";
import { joinGroupSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext();
    const payload = await parseJson(request, joinGroupSchema);
    const group = await joinGroupByInviteCode(context, payload.inviteCode);

    return created(group);
  } catch (error) {
    return handleRouteError(error);
  }
}

