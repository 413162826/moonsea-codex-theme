"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CLIENT_TARGETS } from "../lib/client-target";
import { MoonseaMark } from "./moonsea-mark";
import { OwnerAdminLink } from "./owner-admin-link";
import { setClientTarget, useClientTarget } from "./use-client-target";

export const WIKI_URL =
  "https://github.com/413162826/moonsea-codex-theme/wiki";

export function SiteHeader() {
  const pathname = usePathname();
  const client = useClientTarget();
  const clientConfig = CLIENT_TARGETS[client];

  return (
    <header className="site-header site-header--moonsea">
      <div className="site-header__inner">
        <Link className="brand" href="/" aria-label="月海首页">
          <span className="brand-mark" aria-hidden="true">
            <MoonseaMark />
          </span>
          <span className="brand-copy">
            <strong>月海</strong>
            <small>主题实验室</small>
          </span>
        </Link>
        <nav className="site-nav" aria-label="主要导航">
          <Link className="site-nav__home" href="/" prefetch aria-current={pathname === "/" ? "page" : undefined}>首页</Link>
          <div className="product-switch" aria-label="应用到">
            {(["codex", "workbuddy"] as const).map((target) => (
              <button
                className={client === target ? "is-active" : ""}
                key={target}
                type="button"
                onClick={() => setClientTarget(target)}
                aria-pressed={client === target}
              >
                {CLIENT_TARGETS[target].label}
              </button>
            ))}
          </div>
          <a
            className="download-link"
            href={`/download?client=${client}`}
            aria-label={`下载 ${clientConfig.label} 版`}
          >
            下载
          </a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <p>
        <OwnerAdminLink className="footer-owner-entry">
          月海 · 主题实验室
        </OwnerAdminLink>
      </p>
      <div className="footer-links">
        <Link href="/themes">主题</Link>
        <Link href="/updates">更新日志</Link>
        <Link href="/privacy">隐私说明</Link>
        <a href={WIKI_URL}>使用帮助</a>
      </div>
    </footer>
  );
}
