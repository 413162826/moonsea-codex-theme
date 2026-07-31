"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OwnerAdminLink } from "./owner-admin-link";

export const WIKI_URL =
  "https://github.com/413162826/moonsea-codex-theme/wiki";

export type SiteTone = "light" | "moonsea" | "workbuddy";

type ToneConfig = {
  download: string;
  downloadLabel: string;
  footer: string;
};

const TONE: Record<SiteTone, ToneConfig> = {
  moonsea: {
    download: "/download?client=codex",
    downloadLabel: "下载 Codex 版",
    footer: "月海 · Codex 与 WorkBuddy 主题",
  },
  workbuddy: {
    download: "/download?client=workbuddy",
    downloadLabel: "下载 WorkBuddy 版",
    footer: "月海 · Codex 与 WorkBuddy 主题",
  },
  light: {
    download: "/download?client=codex",
    downloadLabel: "下载 Codex 版",
    footer: "月海 · Codex 与 WorkBuddy 主题",
  },
};

export function SiteHeader({
  tone = "light",
}: {
  tone?: SiteTone;
}) {
  const pathname = usePathname();
  const config = TONE[tone];
  const codexActive = pathname === "/themes" || pathname.startsWith("/themes/");
  const workbuddyActive = pathname === "/workbuddy" || pathname.startsWith("/workbuddy/");

  return (
    <header className={`site-header site-header--${tone}`}>
      <div className="site-header__inner">
        <Link className="brand" href="/" aria-label="月海首页">
          <span className="brand-mark" aria-hidden="true">◐</span>
          <span className="brand-copy">
            <strong>月海</strong>
            <small>主题实验室</small>
          </span>
        </Link>
        <nav className="site-nav" aria-label="主要导航">
          <Link className="site-nav__home" href="/" aria-current={pathname === "/" ? "page" : undefined}>首页</Link>
          <div className="product-switch" aria-label="选择应用">
            <Link className={codexActive ? "is-active" : ""} href="/themes" aria-current={codexActive ? "page" : undefined}>Codex</Link>
            <Link className={workbuddyActive ? "is-active" : ""} href="/workbuddy" aria-current={workbuddyActive ? "page" : undefined}>WorkBuddy</Link>
          </div>
          <OwnerAdminLink />
          <a className="download-link" href={config.download}>
            <span className="download-link__long">{config.downloadLabel}</span>
            <span className="download-link__short">下载</span>
          </a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ tone = "moonsea" }: { tone?: SiteTone }) {
  const config = TONE[tone];
  return (
    <footer>
      <p>{config.footer}</p>
      <div className="footer-links">
        <Link href="/themes">Codex 主题</Link>
        <Link href="/workbuddy">WorkBuddy 主题</Link>
        <Link href="/privacy">隐私说明</Link>
        <a href={WIKI_URL}>使用帮助</a>
      </div>
    </footer>
  );
}
