"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { Button, getButtonClassName } from "@/components/ui/button";

type NoticeTone = "info" | "success" | "warning" | "error";

export function NoticeBanner({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: NoticeTone;
}) {
  return <div className={`notice-banner notice-banner--${tone}`}>{children}</div>;
}

export function LoadingState({ label = "資料載入中..." }: { label?: string }) {
  return (
    <div className="state-card">
      <div className="loading-dot" />
      <div className="stack-xs">
        <h3 className="state-title">請稍候</h3>
        <p className="state-description">{label}</p>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-card state-card--stack">
      <div className="stack-xs">
        <h3 className="state-title">{title}</h3>
        <p className="state-description">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "資料載入失敗",
  description = "請稍後再試一次。",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-card state-card--error state-card--stack">
      <div className="stack-xs">
        <h3 className="state-title">{title}</h3>
        <p className="state-description">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          重新整理
        </Button>
      ) : null}
    </div>
  );
}

export function AuthRequiredState({
  description = "登入後才能查看這個頁面與你的讀書資料。",
  loginHref = "/login",
}: {
  description?: string;
  loginHref?: Route;
}) {
  return (
    <EmptyState
      title="需要先登入"
      description={description}
      action={
        <Link href={loginHref} className={getButtonClassName("primary")}>
          前往登入
        </Link>
      }
    />
  );
}
