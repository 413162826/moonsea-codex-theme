import Link from "next/link";
import { ProCodexPreview } from "./codex-preview";
import { SiteFooter, SiteHeader, WINDOWS_DOWNLOAD_URL } from "./site-chrome";

const heroTheme = {
  name: "潮汐龙境",
  mode: "dark" as const,
  previewGradient: "linear-gradient(135deg, #9fb8c2, #d4d7cb)",
  previewImage: "./wallpapers/tide-dragon-realm.webp",
};

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero__copy">
            <p className="eyebrow">MOONSEA / VISUAL LAYER FOR CODEX</p>
            <h1>让 Codex，<br />看起来终于像你的。</h1>
            <p>从安静的渐变到精制壁纸，让每天打开的工作界面拥有自己的气质。</p>
            <div className="landing-actions">
              <Link className="primary-action" href="/themes">浏览主题 <span aria-hidden="true">↗</span></Link>
              <a className="text-action" href={WINDOWS_DOWNLOAD_URL}>下载 Windows 版</a>
            </div>
          </div>
          <div className="landing-stage">
            <div className="landing-stage__meta">
              <span>01 / PRO EDITION</span>
              <span>TIDE DRAGON REALM</span>
            </div>
            <ProCodexPreview theme={heroTheme} className="landing-codex-window" />
            <p>壁纸不是界面后面的一张图。<br />它应该成为界面的一部分。</p>
          </div>
        </section>

        <section className="landing-manifesto">
          <p className="section-kicker">A VISUAL SYSTEM, NOT A SKIN</p>
          <h2>不是换一张背景。<br />是让壁纸、界面与阅读层成为同一个空间。</h2>
          <div className="manifesto-notes">
            <p><strong>即时应用</strong><span>在主题页挑选，Codex 无需重启。</span></p>
            <p><strong>完整界面</strong><span>顶栏、侧栏、正文和输入区一起适配。</span></p>
            <p><strong>免费与 Pro</strong><span>同一套渲染技术，不同的视觉收藏。</span></p>
          </div>
        </section>

        <section className="landing-themes">
          <div>
            <p className="section-kicker">THE COLLECTION</p>
            <h2>为不同的工作状态，<br />留一片合适的氛围。</h2>
          </div>
          <div className="theme-ribbons" aria-hidden="true">
            <i /><i /><i /><i />
          </div>
          <Link className="collection-link" href="/themes">
            <span>浏览全部主题</span>
            <b aria-hidden="true">↗</b>
          </Link>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
