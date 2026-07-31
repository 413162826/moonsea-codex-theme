"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import type { Theme } from "../lib/theme-catalog";
import { ProCodexPreview } from "./codex-preview";

function wallpaperUrl(theme: Theme) {
  return theme.previewImage?.replace("./", "/");
}

function swatchStyle(theme: Theme): CSSProperties {
  const wallpaper = wallpaperUrl(theme);
  return wallpaper
    ? {
        backgroundImage:
          `linear-gradient(135deg, rgba(4, 20, 30, .08), rgba(4, 20, 30, .28)), url("${wallpaper}")`,
      }
    : { background: theme.previewGradient };
}

export function FeaturedThemeSwitcher({ themes }: { themes: Theme[] }) {
  const [selectedId, setSelectedId] = useState(themes[0]?.id);
  const selectedTheme =
    themes.find((theme) => theme.id === selectedId) ?? themes[0];

  if (!selectedTheme) return null;

  return (
    <>
      <div className="landing-showcase__label">
        <span>今日精选</span>
        <strong>{selectedTheme.name}</strong>
      </div>
      <ProCodexPreview
        key={selectedTheme.id}
        className="landing-codex-preview"
        theme={selectedTheme}
      />
      <div className="landing-theme-switcher" aria-label="切换精选主题">
        <span className="landing-theme-switcher__label">最新主题</span>
        <div className="landing-theme-switcher__options">
          {themes.map((theme) => {
            const selected = theme.id === selectedTheme.id;
            return (
              <button
                key={theme.id}
                type="button"
                className={selected ? "is-active" : ""}
                aria-label={`预览${theme.name}`}
                aria-pressed={selected}
                title={theme.name}
                onClick={() => setSelectedId(theme.id)}
              >
                <span style={swatchStyle(theme)} />
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
