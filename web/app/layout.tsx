import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) throw new Error("缺少站点域名");
  const previewUrl = new URL("/og.png", `https://${host}`).toString();

  return {
    title: {
      default: "月海 Codex 主题",
      template: "%s · 月海",
    },
    description: "为 Codex 提供渐变壁纸、Pro 精选壁纸与沉浸式交互体验。",
    openGraph: {
      title: "月海 Codex 主题",
      description: "让壁纸真正融入界面",
      type: "website",
      images: [{ url: previewUrl, width: 1200, height: 630, alt: "月海 Codex 主题" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "月海 Codex 主题",
      description: "让壁纸真正融入界面",
      images: [previewUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
