"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OwnerAdminLink } from "./owner-admin-link";

export const DOWNLOAD_URL = "/download";
export const WIKI_URL =
  "https://github.com/413162826/moonsea-codex-theme/wiki";

export function SiteHeader({
  tone = "light",
  revealOnHover = false,
  hideNavigation = false,
}: {
  tone?: "light" | "moonsea";
  revealOnHover?: boolean;
  hideNavigation?: boolean;
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
    <>
      <header
        className={`site-header site-header--${tone}${revealOnHover ? " site-header--reveal" : ""}${pointerRevealed ? " site-header--revealed" : ""}`}
      >
        {revealOnHover ? <span className="site-header__reveal-trigger" aria-hidden="true" /> : null}
        <div className="site-header__inner">
          <Link className="brand" href="/" aria-label="月海首页">
            <span className="brand-mark" aria-hidden="true">◐</span>
            <span>月海</span>
          </Link>
          {hideNavigation ? null : (
            <nav className="site-nav" aria-label="主要导航">
              <Link href="/themes">主题</Link>
              <OwnerAdminLink />
              <a className="download-link" href={DOWNLOAD_URL}>
                下载
              </a>
            </nav>
          )}
        </div>
      </header>
      {hideNavigation ? (
        <div className="employee-entry-floating">
          <OwnerAdminLink />
        </div>
      ) : null}
    </>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <p>月海 · Codex 主题与壁纸</p>
      <div className="footer-links">
        <Link href="/themes">浏览主题</Link>
        <Link href="/privacy">隐私说明</Link>
        <a href={WIKI_URL}>使用帮助</a>
      </div>
    </footer>
  );
}
