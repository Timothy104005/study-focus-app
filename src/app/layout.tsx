import type { Metadata } from "next";
import "@/app/globals.css";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Study Focus",
  description: "以專注、排行與小組互動為核心的學生讀書儀表板。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
