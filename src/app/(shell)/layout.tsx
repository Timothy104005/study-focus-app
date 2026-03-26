import Link from "next/link";
import { SiteNavigation } from "@/components/layout/site-navigation";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="brand-card">
          <p className="eyebrow">Study Focus</p>
          <h1 className="brand-title">讀書班</h1>
          <p className="brand-description">
            保持節奏、看見進步，也讓小組一起慢慢往前走。
          </p>
        </div>

        <SiteNavigation />

        <div className="sidebar-footer">
          <p className="meta-text">Frontend MVP</p>
          <Link href="/login" className="text-link">
            登入入口
          </Link>
        </div>
      </aside>

      <div className="shell-content">
        <div className="shell-topbar">
          <div className="stack-xs">
            <span className="eyebrow">今日任務</span>
            <strong className="shell-topbar__title">穩穩讀，慢慢追上前排</strong>
          </div>
          <Link href="/login" className="text-link shell-topbar__link">
            帳號登入
          </Link>
        </div>

        <main>{children}</main>
        <SiteNavigation />
      </div>
    </div>
  );
}
