import Link from "next/link";
import { OwnerAdminLink } from "./owner-admin-link";

export const WINDOWS_DOWNLOAD_URL =
  "https://github.com/413162826/moonsea-codex-theme/releases/latest/download/Moonsea-Codex-Windows-x64.zip";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" href="/" aria-label="月海首页">
          <span className="brand-mark" aria-hidden="true">◐</span>
          <span>月海</span>
        </Link>
        <nav className="site-nav" aria-label="主要导航">
          <Link href="/themes">主题</Link>
          <OwnerAdminLink />
          <a className="download-link" href={WINDOWS_DOWNLOAD_URL}>
            下载 Windows 版
          </a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <p>月海 · Codex 主题与壁纸</p>
      <div className="footer-links">
        <Link href="/themes">浏览主题</Link>
        <a href="https://github.com/413162826/moonsea-codex-theme">GitHub</a>
      </div>
    </footer>
  );
}
