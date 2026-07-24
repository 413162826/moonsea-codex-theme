"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OwnerAdminLink } from "./owner-admin-link";

export const WINDOWS_DOWNLOAD_URL =
  "https://github.com/413162826/moonsea-codex-theme/releases/latest/download/Moonsea-Codex-Windows-x64-Setup.exe";

export function SiteHeader({
  tone = "light",
  revealOnHover = false,
}: {
  tone?: "light" | "moonsea";
  revealOnHover?: boolean;
}) {
  const [pointerRevealed, setPointerRevealed] = useState(false);

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
    <header
      className={`site-header site-header--${tone}${revealOnHover ? " site-header--reveal" : ""}${pointerRevealed ? " site-header--revealed" : ""}`}
    >
      {revealOnHover ? <span className="site-header__reveal-trigger" aria-hidden="true" /> : null}
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
