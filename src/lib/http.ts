import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, z } from "zod";

import type { ApiErrorBody, ApiSuccess } from "@/contracts";
import {
  ERROR_CODE_HEADER,
  TRACE_HEADER,
  createTraceId,
  logOpsEvent,
} from "@/lib/observability";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ data }, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export async function parseJson<Schema extends ZodTypeAny>(
  request: Request,
  schema: Schema,
): Promise<z.output<Schema>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }

  return schema.parse(body);
}

export function handleRouteError(
  error: unknown,
  context?: {
    details?: Record<string, unknown>;
    method?: string;
    route?: string;
    userId?: string | null;
  },
) {
  const traceId = createTraceId();

  if (error instanceof ApiError) {
    logOpsEvent(error.status >= 500 ? "error" : "warn", "api.route_error", {
      traceId,
      route: context?.route ?? "unknown",
      method: context?.method ?? "unknown",
      userId: context?.userId ?? null,
      errorCode: error.code,
      message: error.message,
      status: error.status,
      details: error.details,
      context: context?.details ?? null,
    });

    return NextResponse.json<ApiErrorBody>(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      {
        status: error.status,
        headers: {
          [ERROR_CODE_HEADER]: error.code,
          [TRACE_HEADER]: traceId,
        },
      },
    );
  }

  if (error instanceof ZodError) {
    logOpsEvent("warn", "api.validation_error", {
      traceId,
      route: context?.route ?? "unknown",
      method: context?.method ?? "unknown",
      userId: context?.userId ?? null,
      issues: error.flatten(),
      context: context?.details ?? null,
    });

    return NextResponse.json<ApiErrorBody>(
      {
        error: {
          code: "validation_error",
          message: "Request validation failed.",
          details: error.flatten(),
        },
      },
      {
        status: 422,
        headers: {
          [ERROR_CODE_HEADER]: "validation_error",
          [TRACE_HEADER]: traceId,
        },
      },
    );
  }

  logOpsEvent("error", "api.unhandled_error", {
    traceId,
    route: context?.route ?? "unknown",
    method: context?.method ?? "unknown",
    userId: context?.userId ?? null,
    context: context?.details ?? null,
    error,
  });

  return NextResponse.json<ApiErrorBody>(
    {
      error: {
        code: "internal_error",
        message: "Internal server error.",
      },
    },
    {
      status: 500,
      headers: {
        [ERROR_CODE_HEADER]: "internal_error",
        [TRACE_HEADER]: traceId,
      },
    },
  );
}
