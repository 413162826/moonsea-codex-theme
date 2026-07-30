"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OwnerAdminLink } from "./owner-admin-link";

export const DOWNLOAD_URL = "/download?client=codex";
export const WIKI_URL =
  "https://github.com/413162826/moonsea-codex-theme/wiki";

export type SiteTone = "light" | "moonsea" | "workbuddy";

type ToneConfig = {
  brandName: string;
  brandMark: string;
  home: string;
  themes: string;
  sisterLabel: string;
  sisterHref: string;
  download: string;
  footer: string;
};

const TONE: Record<SiteTone, ToneConfig> = {
  moonsea: {
    brandName: "月海",
    brandMark: "◐",
    home: "/",
    themes: "/themes",
    sisterLabel: "WorkBuddy 壁纸",
    sisterHref: "/workbuddy",
    download: "/download?client=codex",
    footer: "月海 · Codex 主题与壁纸",
  },
  workbuddy: {
    brandName: "WorkBuddy",
    brandMark: "✦",
    home: "/workbuddy",
    themes: "/workbuddy",
    sisterLabel: "月海壁纸",
    sisterHref: "/themes",
    download: "/download?client=workbuddy",
    footer: "WorkBuddy · Codex 主题与壁纸",
  },
  light: {
    brandName: "月海",
    brandMark: "◐",
    home: "/",
    themes: "/themes",
    sisterLabel: "WorkBuddy 壁纸",
    sisterHref: "/workbuddy",
    download: "/download?client=codex",
    footer: "月海 · Codex 主题与壁纸",
  },
};

export function SiteHeader({
  tone = "light",
  revealOnHover = false,
  hideNavigation = false,
}: {
  tone?: SiteTone;
  revealOnHover?: boolean;
  hideNavigation?: boolean;
}) {
  const [pointerRevealed, setPointerRevealed] = useState(false);
  const config = TONE[tone];

  useEffect(() => {
    if (!revealOnHover) return;

    const updateReveal = (event: PointerEvent) => {
      if (event.clientY <= 24) {
        setPointerRevealed(true);
      } else if (event.clientY > 84) {
        setPointerRevealed(false);
      }
    };
    const hideReveal = () => setPointerRevealed(false);

    window.addEventListener("pointermove", updateReveal, { passive: true });
    window.addEventListener("blur", hideReveal);
    return () => {
      window.removeEventListener("pointermove", updateReveal);
      window.removeEventListener("blur", hideReveal);
    };
  }, [revealOnHover]);

  return (
    <>
      <header
        className={`site-header site-header--${tone}${revealOnHover ? " site-header--reveal" : ""}${pointerRevealed ? " site-header--revealed" : ""}`}
      >
        {revealOnHover ? <span className="site-header__reveal-trigger" aria-hidden="true" /> : null}
        <div className="site-header__inner">
          <Link className="brand" href={config.home} aria-label={`${config.brandName}首页`}>
            <span className="brand-mark" aria-hidden="true">{config.brandMark}</span>
            <span>{config.brandName}</span>
          </Link>
          {hideNavigation ? null : (
            <nav className="site-nav" aria-label="主要导航">
              <Link href={config.themes}>主题</Link>
              <OwnerAdminLink />
              <Link className="sister-entry" href={config.sisterHref}>{config.sisterLabel}</Link>
              <a className="download-link" href={config.download}>
                下载
              </a>
            </nav>
          )}
        </div>
      </header>
      {hideNavigation ? (
        <div className="employee-entry-floating">
          <OwnerAdminLink />
          <Link className="sister-entry" href={config.sisterHref}>{config.sisterLabel}</Link>
        </div>
      ) : null}
    </>
  );
}

export function SiteFooter({ tone = "moonsea" }: { tone?: SiteTone }) {
  const config = TONE[tone];
  return (
    <footer>
      <p>{config.footer}</p>
      <div className="footer-links">
        <Link href={config.themes}>浏览主题</Link>
        <Link href="/privacy">隐私说明</Link>
        <a href={WIKI_URL}>使用帮助</a>
      </div>
    </footer>
  );
}
