"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const TRACKED_PATHS = new Set(["/", "/themes", "/download/choose"]);

export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!TRACKED_PATHS.has(pathname)) return;
    const body = new Blob(
      [JSON.stringify({ path: pathname })],
      { type: "application/json" },
    );
    navigator.sendBeacon("/api/analytics/pageview", body);
  }, [pathname]);

  return null;
}
