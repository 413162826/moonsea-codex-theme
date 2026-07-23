import Link from "next/link";
import { OwnerAdminLink } from "./owner-admin-link";
import { ThemeGallery } from "./theme-gallery";

export default function Home() {
  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand" href="/" aria-label="月海主题首页">
            <span className="brand-mark" aria-hidden="true">◐</span>
            <span>月海</span>
          </Link>
          <nav className="site-nav" aria-label="主要导航">
            <a href="#themes">主题墙</a>
            <OwnerAdminLink />
            <a className="download-link" href="https://github.com/413162826/moonsea-codex-theme/releases/latest/download/Moonsea-Codex-Windows-x64.zip">
              下载 Windows 版
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <p className="eyebrow">MOONSEA FOR CODEX</p>
          <h1>给 Codex<br />一片月海。</h1>
          <p className="hero-copy">渐变与 Pro 壁纸，一键应用。</p>
          <div className="hero-actions">
            <a className="primary-action" href="#themes">浏览主题</a>
          </div>
        </section>

        <ThemeGallery />
      </main>

      <footer>
        <p>月海 · Codex 主题与壁纸</p>
        <a href="https://github.com/413162826/moonsea-codex-theme">GitHub</a>
      </footer>
    </>
  );
}
