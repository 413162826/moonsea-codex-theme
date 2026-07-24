import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { ThemeGallery } from "../theme-gallery";

export const metadata: Metadata = {
  title: "主题",
  description: "浏览并应用月海为 Codex 制作的渐变与 Pro 壁纸。",
};

export default function ThemesPage() {
  return (
    <>
      <SiteHeader />
      <main className="themes-page">
        <ThemeGallery />
      </main>
      <SiteFooter />
    </>
  );
}
