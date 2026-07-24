import Link from "next/link";
import { ProCodexPreview, StandardCodexPreview, type PreviewTheme } from "./codex-preview";
import { SiteFooter, SiteHeader, WINDOWS_DOWNLOAD_URL } from "./site-chrome";

const heroTheme: PreviewTheme = {
  name: "潮汐龙境",
  mode: "dark" as const,
  previewGradient: "linear-gradient(135deg, #9fb8c2, #d4d7cb)",
  previewImage: "./wallpapers/tide-dragon-realm.webp",
};

const collection: Array<PreviewTheme & { label: string; note: string }> = [
  {
    name: "月白",
    mode: "light",
    label: "浅色 · 免费",
    note: "清醒、留白、适合长时间阅读",
    previewGradient: "radial-gradient(circle at 18% 14%, #ffffff 0, transparent 38%), linear-gradient(145deg, #edf5f3, #bfd6da 58%, #8eb4bd)",
  },
  {
    name: "深海",
    mode: "dark",
    label: "深色 · 免费",
    note: "低照度工作时的安静蓝调",
    previewGradient: "radial-gradient(circle at 78% 22%, #205f72 0, transparent 34%), linear-gradient(145deg, #07141c, #102b37 62%, #1f5262)",
  },
  {
    name: "紫潮",
    mode: "dark",
    label: "深色 · 免费",
    note: "克制的紫灰，柔和但不甜腻",
    previewGradient: "radial-gradient(circle at 26% 18%, #6c5d85 0, transparent 36%), linear-gradient(145deg, #17131f, #2d2439 60%, #665579)",
  },
  {
    name: "青瓷",
    mode: "light",
    label: "浅色 · 免费",
    note: "带一点绿意的清透阅读空间",
    previewGradient: "radial-gradient(circle at 76% 18%, #f4faf7 0, transparent 36%), linear-gradient(145deg, #e8f0ec, #bdd3c9 58%, #89ada3)",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main className="landing-main">
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

        <section className="home-collection" aria-labelledby="home-collection-title">
          <div className="home-collection__heading">
            <div>
              <p className="section-kicker">BROWSE THE COLLECTION</p>
              <h2 id="home-collection-title">今天想待在<br />哪一种氛围里？</h2>
            </div>
            <div className="home-collection__aside">
              <span>16 个主题</span>
              <p>每张封面都是实际 Codex 界面的缩影。点击进入主题墙，查看完整效果并立即应用。</p>
            </div>
          </div>

          <div className="home-theme-grid">
            <Link className="home-theme-card home-theme-card--featured" href="/themes">
              <div className="home-theme-preview home-theme-preview--pro">
                <ProCodexPreview theme={heroTheme} />
              </div>
              <div className="home-theme-card__caption">
                <span><b>潮汐龙境</b><small>精选 · Pro</small></span>
                <i aria-hidden="true">↗</i>
              </div>
            </Link>

            {collection.map((theme) => (
              <Link className="home-theme-card" href="/themes" key={theme.name}>
                <div className="home-theme-preview" style={{ background: theme.previewGradient }}>
                  <StandardCodexPreview theme={theme} />
                </div>
                <div className="home-theme-card__caption">
                  <span><b>{theme.name}</b><small>{theme.label}</small></span>
                  <p>{theme.note}</p>
                  <i aria-hidden="true">↗</i>
                </div>
              </Link>
            ))}
          </div>

          <Link className="home-collection__all" href="/themes">
            <span>浏览全部主题</span><i aria-hidden="true">↗</i>
          </Link>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
