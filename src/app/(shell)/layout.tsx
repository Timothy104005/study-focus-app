"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AppDrawer } from "@/components/app-drawer";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const shouldHideHamburger = pathname.startsWith("/focus");

  return (
    <div className="shell-mobile">
      <AppDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

      {!shouldHideHamburger ? (
        <button
          type="button"
          className="shell-mobile__hamburger"
          onClick={() => setIsDrawerOpen(true)}
          aria-label="開啟導覽"
        >
          ≡
        </button>
      ) : null}

      <main className="shell-mobile__content">{children}</main>
    </div>
  );
}
