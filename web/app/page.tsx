import Link from "next/link";
import { ProCodexPreview } from "./codex-preview";
import { MoonseaRipple } from "./moonsea-ripple";
import { DOWNLOAD_URL, SiteHeader } from "./site-chrome";

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
              theme={{
                name: "潮汐龙境",
                mode: "dark",
                previewGradient: "linear-gradient(145deg, #123a4b, #061722)",
                previewImage: "./wallpapers/tide-dragon-realm.webp",
              }}
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
