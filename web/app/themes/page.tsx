import type { Metadata } from "next";
import { THEMES } from "../../lib/theme-catalog";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { ThemeGallery } from "../theme-gallery";

export const metadata: Metadata = {
  title: "主题",
  description: "浏览并应用月海为 Codex 制作的渐变与 Pro 壁纸。",
  alternates: { canonical: "/themes" },
  openGraph: {
    title: "月海主题墙",
    description: "浏览免费渐变主题与 Pro 精选壁纸，为 Codex 选择工作氛围。",
    url: "/themes",
  },
};

export default function ThemesPage() {
  return (
    <div className="themes-shell">
      <SiteHeader tone="moonsea" />
      <main className="themes-page">
        <ThemeGallery initialThemes={[...THEMES]} />
      </main>
      <SiteFooter />
    </div>
  );
}
