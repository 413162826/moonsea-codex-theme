"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const TRACKED_PATHS = new Set(["/", "/themes", "/privacy", "/download/choose"]);

export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!TRACKED_PATHS.has(pathname) && !pathname.startsWith("/themes/")) return;
    const parameters = new URLSearchParams(window.location.search);
    const utmSource = parameters.get("utm_source");
    let source = utmSource;
    if (!source && document.referrer) {
      try {
        const referrer = new URL(document.referrer);
        source = referrer.origin === window.location.origin
          ? "internal"
          : referrer.hostname.replace(/^www\./, "");
      } catch {
        source = null;
      }
    }
    const body = new Blob(
      [JSON.stringify({
        path: pathname,
        source: source ?? "direct",
        campaign: parameters.get("utm_campaign"),
        content: parameters.get("utm_content"),
      })],
      { type: "application/json" },
    );
    navigator.sendBeacon("/api/analytics/pageview", body);
  }, [pathname]);

  return null;
}
