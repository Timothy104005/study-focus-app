import { requireAuthenticatedContext } from "@/lib/auth";
import { handleRouteError, ok, parseJson } from "@/lib/http";
import { deleteExamCountdown, getExamCountdown, updateExamCountdown } from "@/lib/services/exam-countdowns";
import { uuidSchema } from "@/lib/validation/common";
import { updateExamCountdownSchema } from "@/lib/validation/schemas";

export async function GET(
  _request: Request,
  context: { params: Promise<{ countdownId: string }> },
) {
  try {
    const { countdownId } = await Promise.resolve(context.params);
    const parsedCountdownId = uuidSchema.parse(countdownId);
    const authContext = await requireAuthenticatedContext();
    const countdown = await getExamCountdown(authContext, parsedCountdownId);

    return ok(countdown);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ countdownId: string }> },
) {
  try {
    const { countdownId } = await Promise.resolve(context.params);
    const parsedCountdownId = uuidSchema.parse(countdownId);
    const authContext = await requireAuthenticatedContext();
    const payload = await parseJson(request, updateExamCountdownSchema);
    const countdown = await updateExamCountdown(authContext, parsedCountdownId, payload);

    return ok(countdown);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ countdownId: string }> },
) {
  try {
    const { countdownId } = await Promise.resolve(context.params);
    const parsedCountdownId = uuidSchema.parse(countdownId);
    const authContext = await requireAuthenticatedContext();
    const deleted = await deleteExamCountdown(authContext, parsedCountdownId);

    return ok(deleted);
  } catch (error) {
    return handleRouteError(error);
  }
}
