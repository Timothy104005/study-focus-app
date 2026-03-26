import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { getGroupPresenceSnapshot } from "@/lib/services/groups";
import { uuidSchema } from "@/lib/validation/common";

export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await Promise.resolve(context.params);
    const parsedGroupId = uuidSchema.parse(groupId);
    const authContext = await requireAuthenticatedContext();
    const presence = await getGroupPresenceSnapshot(authContext, parsedGroupId);

    return ok(presence);
  } catch (error) {
    return handleRouteError(error);
  }
}
