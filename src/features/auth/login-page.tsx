"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NoticeBanner } from "@/components/ui/state-panels";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getReadableErrorMessage } from "@/lib/ui-error";

function resolveAuthError(errorMessage: string) {
  if (errorMessage.includes("Invalid login credentials")) {
    return "帳號或密碼錯誤，請重新確認。";
  }

  if (errorMessage.includes("Email not confirmed")) {
    return "帳號尚未啟用，請聯絡管理員。";
  }

  return "登入失敗，請稍後再試。";
}

export function LoginPage() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/focus";
  const isMockMode = process.env.NEXT_PUBLIC_STUDY_FOCUS_DATA_SOURCE === "mock";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<"login" | "register" | null>(null);

  function redirectToNextPath() {
    const redirectPath = nextPath.startsWith("/") ? nextPath : "/focus";
    window.location.assign(redirectPath);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setIsSubmitting("login");

    try {
      if (isMockMode) {
        setNotice({ text: "Mock 模式已略過實際登入，直接進入 MVP。", tone: "success" });
        redirectToNextPath();
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      redirectToNextPath();
    } catch (reason) {
      const fallback = getReadableErrorMessage(reason, "登入失敗，請稍後再試。");
      setNotice({
        text: resolveAuthError(fallback),
        tone: "error",
      });
    } finally {
      setIsSubmitting(null);
    }
  }

  async function handleRegister() {
    setNotice(null);
    setIsSubmitting("register");

    try {
      if (isMockMode) {
        setNotice({ text: "Mock 模式已建立示範登入，直接前往專注頁。", tone: "success" });
        window.location.assign("/focus");
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signUp({ email, password });

      if (error) {
        throw error;
      }

      setNotice({ text: "註冊成功，正在前往專注頁面。", tone: "success" });
      window.location.assign("/focus");
    } catch (reason) {
      const fallback = getReadableErrorMessage(reason, "註冊失敗，請稍後再試。");
      setNotice({
        text: resolveAuthError(fallback).replace("登入", "註冊"),
        tone: "error",
      });
    } finally {
      setIsSubmitting(null);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-brand">
          <p className="eyebrow">登入</p>
          <h1 className="auth-brand__title">StudyFocus</h1>
          <p className="page-description">使用 Email 與密碼登入，回到今天的專注節奏。</p>
        </div>

        {notice ? <NoticeBanner tone={notice.tone}>{notice.text}</NoticeBanner> : null}

        <form className="field-grid" onSubmit={handleLogin}>
          <div className="stack-xs">
            <label className="field-label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              className="input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="demo@studyfocus.tw"
              required
            />
          </div>

          <div className="stack-xs">
            <label className="field-label" htmlFor="login-password">
              密碼
            </label>
            <input
              id="login-password"
              type="password"
              className="input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="請輸入密碼"
              minLength={6}
              required
            />
          </div>

          <Button type="submit" disabled={isSubmitting !== null} fullWidth>
            {isSubmitting === "login" ? "登入中..." : "登入"}
          </Button>
        </form>

        <button
          type="button"
          className="auth-register-link"
          disabled={isSubmitting !== null}
          onClick={() => void handleRegister()}
        >
          {isSubmitting === "register" ? "註冊中..." : "還沒有帳號？註冊"}
        </button>
      </div>
    </div>
  );
}
