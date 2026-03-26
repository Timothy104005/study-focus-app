import { isApiClientError } from "@/services/api-client";

function translateKnownErrorMessage(message: string, fallback: string) {
  if (!message) {
    return fallback;
  }

  if (message.includes("Missing Supabase environment variables")) {
    return "目前尚未完成 Supabase 環境設定，請先建立 .env.local 並填入 Supabase 連線資訊。";
  }

  if (
    message === "Failed to fetch" ||
    message.includes("NetworkError") ||
    message.includes("Network request failed")
  ) {
    return "目前無法連線到伺服器，請確認應用程式與 API 是否已正常啟動。";
  }

  if (message.includes("Auth session missing")) {
    return "目前沒有有效的登入狀態，請重新登入後再試一次。";
  }

  return message;
}

export function getReadableErrorMessage(reason: unknown, fallback: string) {
  if (isApiClientError(reason)) {
    return translateKnownErrorMessage(reason.message, fallback);
  }

  if (reason instanceof Error) {
    return translateKnownErrorMessage(reason.message, fallback);
  }

  return fallback;
}
