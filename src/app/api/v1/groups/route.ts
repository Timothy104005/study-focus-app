import { requireAuthenticatedContext } from "@/lib/auth";
import { created, handleRouteError, ok, parseJson } from "@/lib/http";
import { createGroup, listGroups } from "@/lib/services/groups";
import { createGroupSchema } from "@/lib/validation/schemas";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext();
    const groups = await listGroups(context);

    return ok(groups);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext();
    const payload = await parseJson(request, createGroupSchema);
    const group = await createGroup(context, {
      name: payload.name,
      description: payload.description ?? null,
    });

    return created(group);
  } catch (error) {
    return handleRouteError(error);
  }
}
