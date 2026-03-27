"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { NoticeBanner } from "@/components/ui/state-panels";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getReadableErrorMessage } from "@/lib/ui-error";

type AuthMode = "login" | "register";

function resolveLoginError(errorMessage: string) {
  if (errorMessage.includes("Invalid login credentials")) {
    return "帳號或密碼錯誤，請重新確認。";
  }

  if (errorMessage.includes("Email not confirmed")) {
    return "信箱尚未驗證，請先完成驗證。";
  }

  return "登入失敗，請稍後再試。";
}

function resolveRegisterError(errorMessage: string) {
  if (errorMessage.includes("User already registered")) {
    return "此 Email 已註冊，請直接登入。";
  }

  if (errorMessage.includes("Password should be at least")) {
    return "密碼長度不足，請至少輸入 6 個字元。";
  }

  return "註冊失敗，請稍後再試。";
}

export function LoginPage() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/";
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modeTitle = useMemo(() => (mode === "login" ? "登入" : "註冊"), [mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName.trim() || undefined,
            },
          },
        });

        if (error) {
          throw error;
        }

        setNotice({ text: "註冊成功，正在前往首頁。", tone: "success" });
        window.location.assign("/");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      const redirectPath = nextPath.startsWith("/") ? nextPath : "/";
      window.location.assign(redirectPath);
    } catch (reason) {
      const fallback = getReadableErrorMessage(reason, mode === "login" ? "登入失敗，請稍後再試。" : "註冊失敗，請稍後再試。");
      setNotice({
        text: mode === "login" ? resolveLoginError(fallback) : resolveRegisterError(fallback),
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleToggleMode() {
    setNotice(null);
    setMode((currentMode) => (currentMode === "login" ? "register" : "login"));
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-brand">
          <p className="eyebrow">{modeTitle}</p>
          <h1 className="auth-brand__title">StudyFocus</h1>
          <p className="page-description">
            {mode === "login" ? "使用 Email 與密碼登入，回到今天的專注節奏。" : "建立新帳號，開始你的每日專注學習。"}
          </p>
        </div>

        {notice ? <NoticeBanner tone={notice.tone}>{notice.text}</NoticeBanner> : null}

        <form className="field-grid" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <div className="stack-xs">
              <label className="field-label" htmlFor="register-display-name">
                顯示名稱（選填）
              </label>
              <input
                id="register-display-name"
                type="text"
                className="input"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="例如：小明"
              />
            </div>
          ) : null}

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

          <Button type="submit" disabled={isSubmitting} fullWidth>
            {isSubmitting ? `${modeTitle}中...` : modeTitle}
          </Button>
        </form>

        <button type="button" className="auth-register-link" disabled={isSubmitting} onClick={handleToggleMode}>
          {mode === "login" ? "還沒有帳號？註冊" : "已有帳號？登入"}
        </button>
      </div>
    </div>
  );
}
