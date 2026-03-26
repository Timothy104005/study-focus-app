"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-Hant">
      <body>
        <div className="auth-shell">
          <div className="auth-panel">
            <p className="eyebrow">系統錯誤</p>
            <h1 className="page-title">頁面暫時出了點狀況</h1>
            <p className="page-description">{error.message || "請重新整理後再試一次。"}</p>
            <button className="btn btn--primary" onClick={reset} type="button">
              重新整理
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

