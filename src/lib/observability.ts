type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  [key: string]: unknown;
}

interface RouteErrorLogContext {
  details?: LogPayload;
  method?: string;
  route?: string;
  userId?: string | null;
}

const TRACE_HEADER = "x-study-focus-trace-id";
const ERROR_CODE_HEADER = "x-study-focus-error-code";

function serializePayload(payload: LogPayload) {
  return JSON.stringify(
    payload,
    (_key, value) => {
      if (value instanceof Error) {
        return {
          message: value.message,
          name: value.name,
          stack: value.stack,
        };
      }

      return value;
    },
    0,
  );
}

export function createTraceId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function logOpsEvent(level: LogLevel, event: string, payload: LogPayload = {}) {
  const entry = {
    event,
    level,
    timestamp: new Date().toISOString(),
    ...payload,
  };
  const line = `[study-focus][${level}] ${serializePayload(entry)}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export function buildRouteErrorLogContext(
  route: string,
  method: string,
  options: Omit<RouteErrorLogContext, "route" | "method"> = {},
) {
  return {
    route,
    method,
    ...options,
  } satisfies RouteErrorLogContext;
}

export { ERROR_CODE_HEADER, TRACE_HEADER };
