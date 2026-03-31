"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { cn } from "@/lib/cn";

const drawerItems: Array<{ href: Route; label: string }> = [
  { href: "/focus", label: "專注" },
  { href: "/groups", label: "小組" },
  { href: "/exams", label: "計畫" },
  { href: "/leaderboard", label: "紀錄" },
  { href: "/profile", label: "我的" },
];

interface AppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AppDrawer({ isOpen, onClose }: AppDrawerProps) {
  const pathname = usePathname();

  return (
    <>
      <aside className={cn("app-drawer", isOpen && "app-drawer--open")}>
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
