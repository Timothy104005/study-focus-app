"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, getButtonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { NoticeBanner } from "@/components/ui/state-panels";
import { getReadableErrorMessage } from "@/lib/ui-error";
import { getStudyFocusApi } from "@/services/study-focus-api";

const studyFocusApi = getStudyFocusApi();

function resolveAuthErrorMessage(authStatus: string | null) {
  if (authStatus === "missing-code") {
    return "登入連結缺少必要驗證資訊，請重新寄送一次登入信。";
  }

  if (authStatus === "error") {
    return "登入驗證沒有完成，請重新寄送登入信後再試一次。";
  }

  return null;
}

export function LoginPage() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/";
  const authErrorMessage = useMemo(
    () => resolveAuthErrorMessage(searchParams.get("auth")),
    [searchParams],
  );
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "sent">("email");
  const [notice, setNotice] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(authErrorMessage ? { text: authErrorMessage, tone: "error" } : null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    try {
      const result = await studyFocusApi.requestEmailOtp(email, nextPath);
      setStep("sent");
      setNotice({
        text: `登入連結已寄到 ${result.maskedEmail}。${result.deliveryHint}`,
        tone: "success",
      });
    } catch (reason) {
      setNotice({
        text: getReadableErrorMessage(reason, "登入信寄送失敗，請稍後再試一次。"),
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <PageHeader
          eyebrow="登入"
          title="用 Email 登入讀書班"
          description="目前 MVP 會寄送 Email 登入連結。打開信件後，系統會把你帶回這個讀書專注 App。"
        />

        {notice ? (
          <NoticeBanner tone={notice.tone}>{notice.text}</NoticeBanner>
        ) : null}

        {step === "email" ? (
          <form className="field-grid" onSubmit={handleRequestLink}>
            <div className="stack-xs">
              <label className="field-label" htmlFor="login-email">
                學校 Email 或常用信箱
              </label>
              <input
                id="login-email"
                type="email"
                className="input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="student@example.com"
                required
              />
              <p className="field-help">
                不需要密碼，收到登入信後直接點開即可。
              </p>
            </div>

            <Button type="submit" disabled={isSubmitting} fullWidth>
              {isSubmitting ? "寄送中..." : "寄送登入連結"}
            </Button>
          </form>
        ) : null}

        {step === "sent" ? (
          <div className="state-card state-card--stack">
            <div className="stack-xs">
              <h3 className="state-title">請到信箱完成登入</h3>
              <p className="state-description">
                找到 Study Focus 的登入信後直接點開，系統就會回到 App。
              </p>
            </div>
            <div className="button-row">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep("email")}
              >
                重新輸入 Email
              </Button>
              <Link href="/" className={getButtonClassName("ghost")}>
                先回首頁
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
