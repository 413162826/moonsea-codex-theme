import Link from "next/link";
import { ProCodexPreview, type PreviewTheme } from "./codex-preview";
import { MoonseaRipple } from "./moonsea-ripple";
import { SiteHeader, WINDOWS_DOWNLOAD_URL } from "./site-chrome";

const heroTheme: PreviewTheme = {
  name: "潮汐龙境",
  mode: "dark" as const,
  previewGradient: "linear-gradient(135deg, #9fb8c2, #d4d7cb)",
  previewImage: "./wallpapers/tide-dragon-realm.webp",
};

export default function Home() {
  return (
    <>
      <SiteHeader tone="moonsea" />

      <main className="landing-main">
        <MoonseaRipple />
        <section className="landing-hero">
          <div className="landing-hero__copy">
            <p className="eyebrow">MOONSEA / CURATED CODEX THEMES</p>
            <h1>为你的 Codex，<br />选一片海。</h1>
            <p>免费的渐变主题与精制 Pro 壁纸。先看见喜欢的，再决定今天如何工作。</p>
            <div className="landing-actions">
              <Link className="primary-action" href="/themes">进入主题墙 <span aria-hidden="true">↗</span></Link>
              <a className="text-action" href={WINDOWS_DOWNLOAD_URL}>下载 Windows 版</a>
            </div>
          </div>
          <div className="landing-stage">
            <div className="landing-stage__meta">
              <span>FEATURED / PRO 01</span>
              <span>潮汐龙境</span>
            </div>
            <ProCodexPreview theme={heroTheme} className="landing-codex-window" />
            <p>壁纸、界面与阅读层<br />在同一套色彩里工作。</p>
          </div>
        </section>
      </main>
    </>
  );
}
