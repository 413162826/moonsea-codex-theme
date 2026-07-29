import type { Metadata } from "next";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "../lib/site";
import { PageViewTracker } from "./page-view-tracker";

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: {
    default: SITE_NAME,
    template: "%s · 月海",
  },
  description: "免费主题，让 Codex 更沉浸。保持安静、专注、氛围编程。",
  openGraph: {
    title: SITE_NAME,
    description: "免费主题，让 Codex 更沉浸",
    type: "website",
    siteName: SITE_NAME,
    locale: "zh_CN",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: "免费主题，让 Codex 更沉浸",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <PageViewTracker />
        {children}
      </body>
    </html>
  );
}
