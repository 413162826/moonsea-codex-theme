"use client";

import { useState } from "react";
import { SITE_URL } from "../../../lib/site";

export function ThemeActions({ themeId, basePath = "/themes", client = "codex" }: { themeId: string; basePath?: string; client?: string }) {
  const [shareLabel, setShareLabel] = useState("复制同款链接");

  const download = () => {
    window.localStorage.setItem("moonsea_pending_theme", themeId);
    window.location.assign(`/download?client=${encodeURIComponent(client)}&theme=${encodeURIComponent(themeId)}`);
  };

  const copyShareLink = async () => {
    const shareUrl = new URL(`${basePath}/${themeId}`, SITE_URL);
    shareUrl.searchParams.set("utm_source", "share");
    shareUrl.searchParams.set("utm_campaign", "theme_referral");
    shareUrl.searchParams.set("utm_content", themeId);
    try {
      await navigator.clipboard.writeText(shareUrl.toString());
      setShareLabel("链接已复制");
    } catch {
      setShareLabel("复制失败");
    }
  };

  return (
    <div className="theme-detail__actions">
      <button type="button" onClick={download}>下载安装</button>
      <button type="button" className="secondary" onClick={() => void copyShareLink()}>
        {shareLabel}
      </button>
    </div>
  );
}
