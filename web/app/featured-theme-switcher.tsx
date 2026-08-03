"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { Theme } from "../lib/theme-catalog";
import { isThemeNewToday } from "../lib/theme-recency";
import { ProCodexPreview } from "./codex-preview";

function swatchStyle(theme: Theme): CSSProperties {
  return { background: theme.previewGradient };
}

function selectFeatured(themes: Theme[]) {
  const latest = [...themes].reverse();
  const wallpapers = latest.filter((theme) => theme.previewImage);
  const gradients = latest.filter((theme) => !theme.previewImage);
  return [...wallpapers, ...gradients].slice(0, 6);
}

export function FeaturedThemeSwitcher({ themes: initialThemes }: { themes: Theme[] }) {
  const [themes, setThemes] = useState(initialThemes);
  const [selectedId, setSelectedId] = useState(initialThemes[0]?.id);

  useEffect(() => {
    const loadThemes = async () => {
      const response = await fetch("/api/themes");
      if (!response.ok) throw new Error("精选主题加载失败");
      const body = await response.json() as Theme[];
      setThemes(selectFeatured(body));
    };
    void loadThemes();
  }, []);

  const selectedTheme =
    themes.find((theme) => theme.id === selectedId) ?? themes[0];

  if (!selectedTheme) return null;

  return (
    <>
      <div className="landing-showcase__label">
        <span>
          今日精选
          {isThemeNewToday(selectedTheme) ? <em>NEW</em> : null}
        </span>
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
