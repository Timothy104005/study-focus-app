import type { ApiErrorBody, ApiSuccess } from "@/contracts";
import { ERROR_CODE_HEADER, TRACE_HEADER, logOpsEvent } from "@/lib/observability";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

function isApiErrorBody(payload: unknown): payload is ApiErrorBody {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  );
}

function isApiSuccess<T>(payload: unknown): payload is ApiSuccess<T> {
  return typeof payload === "object" && payload !== null && "data" in payload;
}

async function parsePayload(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.length > 0 ? text : null;
}

export async function requestJson<T>(
  path: string,
  init?: RequestInit,
  options?: { baseUrl?: string },
): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;

  try {
    response = await fetch(`${options?.baseUrl ?? ""}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    logOpsEvent("error", "client_api.network_failure", {
      error,
      method: init?.method ?? "GET",
      path,
    });
    throw error;
  }

  const payload = await parsePayload(response);
  const traceId = response.headers.get(TRACE_HEADER);
  const errorCode = response.headers.get(ERROR_CODE_HEADER);

  if (!response.ok) {
    logOpsEvent(response.status >= 500 ? "error" : "warn", "client_api.request_failed", {
      errorCode,
      method: init?.method ?? "GET",
      path,
      payload,
      status: response.status,
      traceId,
    });

    if (isApiErrorBody(payload)) {
      throw new ApiClientError(
        payload.error.message,
        response.status,
        payload.error.code ?? errorCode ?? undefined,
        payload.error.details,
      );
    }

    throw new ApiClientError(
      typeof payload === "string" && payload.length > 0
        ? payload
        : `API request failed with status ${response.status}.`,
      response.status,
    );
  }

  if (isApiSuccess<T>(payload)) {
    return payload.data;
  }

  return payload as T;
}
