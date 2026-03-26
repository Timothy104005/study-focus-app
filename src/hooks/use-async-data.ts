"use client";

import { useEffect, useState } from "react";
import { isApiClientError } from "@/services/api-client";
import { getReadableErrorMessage } from "@/lib/ui-error";

type AsyncStatus = "loading" | "success" | "error";

export interface AsyncErrorInfo {
  code?: string;
  details?: unknown;
  message: string;
  status?: number;
}

function normalizeAsyncError(reason: unknown): AsyncErrorInfo {
  if (isApiClientError(reason)) {
    return {
      code: reason.code,
      details: reason.details,
      message: getReadableErrorMessage(reason, "讀取資料時發生錯誤。"),
      status: reason.status,
    };
  }

  if (reason instanceof Error) {
    return { message: getReadableErrorMessage(reason, "讀取資料時發生錯誤。") };
  }

  return { message: "讀取資料時發生錯誤。" };
}

export function useAsyncData<T>(
  loader: () => Promise<T>,
  dependencies: readonly unknown[],
) {
  const [status, setStatus] = useState<AsyncStatus>("loading");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<AsyncErrorInfo | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    setStatus("loading");
    setError(null);

    loader()
      .then((result) => {
        if (!active) {
          return;
        }

        setData(result);
        setStatus("success");
      })
      .catch((reason: unknown) => {
        if (!active) {
          return;
        }

        setError(normalizeAsyncError(reason));
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [...dependencies, reloadToken]);

  return {
    data,
    error,
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
    errorStatus: error?.status ?? null,
    isError: status === "error",
    isLoading: status === "loading",
    reload: () => setReloadToken((value) => value + 1),
    setData,
  };
}
