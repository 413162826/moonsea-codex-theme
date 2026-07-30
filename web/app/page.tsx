import type { Metadata } from "next";
import Link from "next/link";
import { getTheme } from "../lib/theme-catalog";
import { ProCodexPreview } from "./codex-preview";
import { MoonseaRipple } from "./moonsea-ripple";
import { DOWNLOAD_URL, SiteHeader } from "./site-chrome";

const featuredTheme = getTheme("moonlit-silent");
if (!featuredTheme || featuredTheme.edition !== "pro") {
  throw new Error("首页精选主题 moonlit-silent 不存在");
}

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    title: "免费主题，让 Codex 更沉浸",
    description: "保持安静、专注、氛围编程。",
    url: "/",
  },
};

export default function Home() {
  return (
    <>
      <SiteHeader tone="moonsea" revealOnHover hideNavigation />

      <main className="landing-main">
        <MoonseaRipple />
        <section className="landing-hero">
          <div className="landing-hero__copy">
            <p className="eyebrow">FREE THEMES / IMMERSIVE CODEX</p>
            <h1>免费主题，<br />让 Codex<br />更沉浸。</h1>
            <p>保持安静、专注、氛围编程。</p>
            <div className="landing-actions">
              <Link className="primary-action" href="/themes">进入主题墙 <span aria-hidden="true">↗</span></Link>
              <a className="text-action" href={DOWNLOAD_URL}>下载</a>
            </div>
          </div>
          <div className="landing-hero__showcase">
            <ProCodexPreview
              className="landing-codex-preview"
              theme={featuredTheme}
            />
            <div className="landing-hero__interaction" aria-hidden="true">
              <span className="landing-hero__signal" />
              <p>MOVE THROUGH THE DEEP<br />鱼群会让出你的方向</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
