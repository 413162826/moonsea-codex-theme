import type { Metadata } from "next";
import Link from "next/link";
import { getTheme } from "../lib/theme-catalog";
import { ProCodexPreview } from "./codex-preview";
import { MoonseaRipple } from "./moonsea-ripple";
import { SiteHeader } from "./site-chrome";

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
      <SiteHeader tone="moonsea" />

      <main className="landing-main">
        <MoonseaRipple />
        <section className="landing-hero">
          <div className="landing-hero__copy">
            <p className="eyebrow">MOONSEA THEME LAB</p>
            <h1>
              <span>免费主题，</span>
              <span>让 Codex</span>
              <span>更沉浸。</span>
            </h1>
            <p className="landing-subtitle">保持安静、专注、氛围编程。</p>
            <div className="landing-actions">
              <Link className="primary-action" href="/themes">浏览 Codex 主题 <span aria-hidden="true">↗</span></Link>
              <Link className="secondary-action" href="/workbuddy">浏览 WorkBuddy 主题</Link>
            </div>
            <p className="landing-proof">同一套主题，一键应用到 Codex 或 WorkBuddy。</p>
          </div>
          <div className="landing-hero__showcase">
            <div className="landing-showcase__label">
              <span>今日精选</span>
              <strong>月海无声</strong>
            </div>
            <ProCodexPreview
              className="landing-codex-preview"
              theme={featuredTheme}
            />
            <div className="landing-hero__interaction" aria-hidden="true">
              <span className="landing-hero__signal" />
              <p>一套主题 · 两个工作台<br />网页选择，助手自动应用</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
