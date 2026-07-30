import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import { getThemesWithUploads } from "../../lib/theme-catalog";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { ThemeGallery } from "../theme-gallery";

export const metadata: Metadata = {
  title: { absolute: "WorkBuddy 主题墙" },
  description: "浏览并应用 WorkBuddy 为 Codex 制作的渐变与 Pro 壁纸。",
  alternates: { canonical: "/workbuddy" },
  openGraph: {
    title: "WorkBuddy 主题墙",
    description: "浏览免费渐变主题与 Pro 精选壁纸，为 Codex 选择工作氛围。",
    url: "/workbuddy",
  },
};

export const dynamic = "force-dynamic";

export default async function WorkbuddyPage() {
  const themes = await getThemesWithUploads(env.DB);
  return (
    <div className="themes-shell">
      <SiteHeader tone="workbuddy" />
      <main className="themes-page">
        <ThemeGallery
          initialThemes={themes}
          basePath="/workbuddy"
          apiRoot="http://127.0.0.1:17322"
          clientLabel="WorkBuddy"
          client="workbuddy"
        />
      </main>
      <SiteFooter tone="workbuddy" />
    </div>
  );
}
