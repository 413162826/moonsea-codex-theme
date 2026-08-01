import type { Metadata } from "next";
import { SITE_URL } from "../../lib/site";
import { SITE_UPDATES } from "../../lib/site-updates";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { UpdatesTimeline } from "./updates-timeline";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "更新日志",
  description: "沿着月海的发布线，查看主题、壁纸、助手与网站体验的每一次更新。",
  alternates: { canonical: "/updates" },
  openGraph: {
    title: "月海更新日志",
    description: "主题、壁纸、助手与网站体验的持续更新。",
    url: "/updates",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "更新日志",
  description: "沿着月海的发布线，查看主题、壁纸、助手与网站体验的每一次更新。",
  url: new URL("/updates", SITE_URL).toString(),
  mainEntity: {
    "@type": "ItemList",
    itemListElement: SITE_UPDATES.map((update, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: update.title,
      url: new URL(`/updates#${update.id}`, SITE_URL).toString(),
    })),
  },
};

export default function UpdatesPage() {
  return (
    <div className="themes-shell updates-shell">
      <SiteHeader />
      <main className="updates-page">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <header className="updates-hero">
          <p className="updates-hero__kicker">PRODUCT CHANGELOG</p>
          <h1>更新日志</h1>
          <p>记录功能更新、体验改进与每一张新壁纸。</p>
        </header>
        <UpdatesTimeline updates={SITE_UPDATES} />
      </main>
      <SiteFooter />
    </div>
  );
}
