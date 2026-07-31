"use client";

import Link from "next/link";
import { useClientTarget } from "./use-client-target";

export function ThemeBrowserLink() {
  const client = useClientTarget();
  return (
    <Link
      className="theme-action"
      href={`/themes?client=${client}`}
      prefetch
    >
      浏览主题 <span aria-hidden="true">↗</span>
    </Link>
  );
}
