"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NoticeBanner } from "@/components/ui/state-panels";
import { LangSwitcher } from "@/components/ui/lang-switcher";
import { useI18n } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getReadableErrorMessage } from "@/lib/ui-error";

type AuthMode = "login" | "register";

function resolveLoginError(msg: string) {
  if (msg.includes("Invalid login credentials")) return "Incorrect email or password.";
  if (msg.includes("Email not confirmed")) return "Email not verified. Please check your inbox.";
  return "Sign in failed. Please try again.";
}

function resolveRegisterError(msg: string) {
  if (msg.includes("User already registered")) return "This email is already registered. Sign in instead.";
  if (msg.includes("Password should be at least")) return "Password too short — minimum 6 characters.";
  return "Registration failed. Please try again.";
}

export function LoginPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/";
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modeTitle = useMemo(() => (mode === "login" ? t("auth_login") : t("auth_register")), [mode, t]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName.trim() || undefined } },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice({ text: t("auth_confirm_email"), tone: "success" });
          return;
        }
        setNotice({ text: t("auth_register_success"), tone: "success" });
        window.location.assign("/focus");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Default landing page after login is /focus
      const redirectPath = nextPath.startsWith("/") && nextPath !== "/" ? nextPath : "/focus";
      window.location.assign(redirectPath);
    } catch (reason) {
      const fallback = getReadableErrorMessage(reason, "Error");
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
    setMode((m) => (m === "login" ? "register" : "login"));
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">

        {/* Top row: brand + lang */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div className="auth-brand">
            <p className="eyebrow">{modeTitle}</p>
            <h1 className="auth-brand__title">Study<span>Focus</span></h1>
            <p className="page-description">
              {mode === "login" ? t("auth_login_desc") : t("auth_register_desc")}
            </p>
          </div>
          <LangSwitcher />
        </div>

        {notice ? <NoticeBanner tone={notice.tone}>{notice.text}</NoticeBanner> : null}

        <form className="field-grid" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <div className="stack-xs">
              <label className="field-label" htmlFor="register-display-name">
                {t("auth_display_name")}
              </label>
              <input
                id="register-display-name"
                type="text"
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("auth_display_name_hint")}
              />
            </div>
          ) : null}

          <div className="stack-xs">
            <label className="field-label" htmlFor="login-email">{t("auth_email")}</label>
            <input
              id="login-email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth_email_hint")}
              required
            />
          </div>

          <div className="stack-xs">
            <label className="field-label" htmlFor="login-password">{t("auth_password")}</label>
            <input
              id="login-password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth_password_hint")}
              minLength={6}
              required
            />
          </div>

          <Button type="submit" disabled={isSubmitting} fullWidth>
            {isSubmitting ? t("auth_submitting") : modeTitle}
          </Button>
        </form>

        <button type="button" className="auth-register-link" disabled={isSubmitting} onClick={handleToggleMode}>
          {mode === "login" ? t("auth_to_register") : t("auth_to_login")}
        </button>
      </div>
    </div>
  );
}
