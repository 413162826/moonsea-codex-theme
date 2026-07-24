import Link from "next/link";
import { ProCodexPreview } from "./codex-preview";
import { MoonseaRipple } from "./moonsea-ripple";
import { SiteHeader, WINDOWS_DOWNLOAD_URL } from "./site-chrome";

export default function Home() {
  return (
    <>
      <SiteHeader tone="moonsea" revealOnHover />

      <main className="landing-main">
        <MoonseaRipple />
        <section className="landing-hero">
          <div className="landing-hero__copy">
            <p className="eyebrow">MOONSEA / THE TWILIGHT ZONE</p>
            <h1>为你的 Codex，<br />选一片海。</h1>
            <p>让微光沉进工作界面。掠过深海，鱼群会从你的指针旁散开，再慢慢游回幽蓝。</p>
            <div className="landing-actions">
              <Link className="primary-action" href="/themes">进入主题墙 <span aria-hidden="true">↗</span></Link>
              <a className="text-action" href={WINDOWS_DOWNLOAD_URL}>下载 Windows 版</a>
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
