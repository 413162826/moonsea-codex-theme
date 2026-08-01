import type { Metadata } from "next";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "../lib/site";
import { PageViewTracker } from "./page-view-tracker";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}#organization`,
      name: "月海主题实验室",
      url: SITE_URL.toString(),
      sameAs: [
        "https://github.com/413162826/moonsea-codex-theme",
        "https://x.com/HmafVj0nsz59334",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      url: SITE_URL.toString(),
      name: "月海主题",
      description: "免费主题，让 Codex / WorkBuddy 更沉浸。",
      publisher: { "@id": `${SITE_URL}#organization` },
      inLanguage: "zh-CN",
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: {
    default: SITE_NAME,
    template: "%s · 月海",
  },
  description: "免费主题，让 Codex / WorkBuddy 更沉浸。保持安静、专注、氛围编程。",
  openGraph: {
    title: SITE_NAME,
    description: "免费主题，让 Codex / WorkBuddy 更沉浸",
    type: "website",
    siteName: SITE_NAME,
    locale: "zh_CN",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: "免费主题，让 Codex / WorkBuddy 更沉浸",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <PageViewTracker />
        {children}
      </body>
    </html>
  );
}
