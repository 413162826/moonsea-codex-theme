import type { Metadata } from "next";
import { THEMES } from "../lib/theme-catalog";
import { FeaturedThemeSwitcher } from "./featured-theme-switcher";
import { MoonseaRipple } from "./moonsea-ripple";
import { SiteFooter, SiteHeader } from "./site-chrome";
import { ThemeBrowserLink } from "./theme-browser-link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    title: "免费主题，让 Codex / WorkBuddy 更沉浸",
    description: "保持安静、专注、氛围编程。",
    url: "/",
  },
};

export default function Home() {
  const themes = [...THEMES].reverse();
  const latestWallpapers = themes.filter((theme) => theme.previewImage);
  const latestGradients = themes.filter((theme) => !theme.previewImage);
  const featuredThemes = [...latestWallpapers, ...latestGradients].slice(0, 6);

  return (
    <div className="landing-shell">
      <SiteHeader />

      <main className="landing-main">
        <MoonseaRipple />
        <section className="landing-hero">
          <div className="landing-hero__copy">
            <p className="eyebrow">MOONSEA THEME LAB</p>
            <h1>
              <span>免费主题，</span>
              <span className="landing-title__products">让 Codex / WorkBuddy</span>
              <span>更沉浸。</span>
            </h1>
            <p className="landing-subtitle">保持安静、专注、氛围编程。</p>
            <div className="landing-actions">
              <ThemeBrowserLink />
            </div>
            <p className="landing-proof">同一套主题，一键应用到 Codex 或 WorkBuddy。</p>
          </div>
          <div className="landing-hero__showcase">
            <FeaturedThemeSwitcher themes={featuredThemes} />
            <div className="landing-hero__interaction" aria-hidden="true">
              <span className="landing-hero__signal" />
              <p>一套主题 · 两个工作台<br />网页选择，助手自动应用</p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
