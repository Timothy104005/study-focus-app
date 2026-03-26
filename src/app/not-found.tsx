import Link from "next/link";
import { getButtonClassName } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <p className="eyebrow">找不到頁面</p>
        <h1 className="page-title">這個頁面不存在</h1>
        <p className="page-description">
          可能是路徑錯了，或是這個小組已經被移除。
        </p>
        <Link href="/" className={getButtonClassName("primary")}>
          回首頁
        </Link>
      </div>
    </div>
  );
}

