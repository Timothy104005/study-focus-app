"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const navigationItems: Array<{ href: Route; label: string; shortLabel: string }> = [
  { href: "/focus", label: "專注", shortLabel: "專注" },
  { href: "/groups", label: "小組", shortLabel: "小組" },
  { href: "/leaderboard", label: "排行", shortLabel: "排行" },
  { href: "/profile", label: "我的", shortLabel: "我的" },
  { href: "/exams", label: "考試", shortLabel: "考試" },
];

export function SiteNavigation() {
  const pathname = usePathname();

  return (
    <>
      <nav className="desktop-nav">
        {navigationItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("nav-link", isActive && "nav-link--active")}
            >
              <span className="nav-link__label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <nav className="mobile-nav">
        {navigationItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "mobile-nav__link",
                isActive && "mobile-nav__link--active",
              )}
            >
              {item.shortLabel}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
