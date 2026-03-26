import type { Metadata } from "next";
import "@/app/globals.css";

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
      <body>{children}</body>
    </html>
  );
}
