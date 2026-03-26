import type { LegacyStudyFocusApi } from "@/contracts/study-focus";
import { createMockStudyFocusApi } from "@/lib/mock-store";
import { createHttpStudyFocusApi } from "@/services/http-study-focus-api";

let cachedApi: LegacyStudyFocusApi | null = null;

export function getLegacyStudyFocusApi() {
  if (cachedApi) {
    return cachedApi;
  }

  const source = process.env.NEXT_PUBLIC_STUDY_FOCUS_DATA_SOURCE;
  const baseUrl = process.env.NEXT_PUBLIC_STUDY_FOCUS_API_BASE_URL;
  const shouldUseHttp = source === "api" || (source !== "mock" && Boolean(baseUrl));

  cachedApi =
    shouldUseHttp ? createHttpStudyFocusApi(baseUrl ?? "/api") : createMockStudyFocusApi();

  return cachedApi;
}

export const getStudyFocusApi = getLegacyStudyFocusApi;
