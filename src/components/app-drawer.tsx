"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";
import { LangSwitcher } from "@/components/ui/lang-switcher";

interface AppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AppDrawer({ isOpen, onClose }: AppDrawerProps) {
  const pathname = usePathname();
  const { t } = useI18n();

  const drawerItems: Array<{ href: Route; label: string }> = [
    { href: "/focus", label: t("nav_focus") },
    { href: "/groups", label: t("nav_groups") },
    { href: "/leaderboard", label: t("nav_record") },
    { href: "/profile", label: t("nav_profile") },
    { href: "/exams", label: t("nav_plan") },
  ];

  return (
    <>
      <aside className={cn("app-drawer", isOpen && "app-drawer--open")}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--brick-400)",
          }}>
            StudyFocus
          </span>
          <LangSwitcher />
        </div>

        <nav className="app-drawer__nav" aria-label="主要導覽">
          {drawerItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("app-drawer__item", isActive && "app-drawer__item--active")}
                onClick={onClose}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <button
        type="button"
        className={cn("app-drawer__overlay", isOpen && "app-drawer__overlay--open")}
        onClick={onClose}
        aria-label="關閉導覽抽屜"
      />
    </>
  );
}
