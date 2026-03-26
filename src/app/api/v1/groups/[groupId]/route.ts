import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { getGroup } from "@/lib/services/groups";
import { uuidSchema } from "@/lib/validation/common";

export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await Promise.resolve(context.params);
    const parsedGroupId = uuidSchema.parse(groupId);
    const authContext = await requireAuthenticatedContext();
    const group = await getGroup(authContext, parsedGroupId);

    return ok(group);
  } catch (error) {
    return handleRouteError(error);
  }
}
