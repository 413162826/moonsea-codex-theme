"use client";

import { useEffect, useMemo, useState } from "react";

const API_ROOT = "http://127.0.0.1:17321";

type Theme = {
  id: string;
  name: string;
  description: string;
  edition: "standard" | "pro";
  mode: "light" | "dark";
  preview?: string[];
  previewGradient: string;
  previewImage?: string;
};

type Catalog = {
  catalogVersion: number;
  themes: Theme[];
};

type Connection = {
  connected: boolean;
  runtimeCapable: boolean;
  activeThemeId: string | null;
  message: string;
};

const initialConnection: Connection = {
  connected: false,
  runtimeCapable: false,
  activeThemeId: null,
  message: "打开月海版后会自动连接",
};

export function ThemeGallery() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [filter, setFilter] = useState<"all" | "light" | "dark" | "pro">("all");
  const [query, setQuery] = useState("");
  const [connection, setConnection] = useState(initialConnection);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/catalog.json", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("主题暂时没有准备好");
        return response.json() as Promise<Catalog>;
      })
      .then((catalog) => {
        if (active) setThemes(catalog.themes);
      })
      .catch((error: Error) => {
        if (active) setNotice(error.message);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const connect = async () => {
      try {
        const response = await fetch(`${API_ROOT}/api/status`, { cache: "no-store" });
        const body = await response.json() as {
          connected: boolean;
          runtimeCapable?: boolean;
          catalogVersion?: number;
          themeId?: string;
          message?: string;
        };
        if (!response.ok || !body.connected) throw new Error(body.message ?? "Codex 未连接");
        if (!active) return;
        setConnection({
          connected: true,
          runtimeCapable: body.runtimeCapable === true && (body.catalogVersion ?? 0) >= 3,
          activeThemeId: body.themeId ?? null,
          message: "Codex 已连接，可立即应用",
        });
      } catch {
        if (active) setConnection(initialConnection);
      }
    };
    void connect();
    const timer = window.setInterval(connect, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const visibleThemes = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("zh-CN");
    return themes.filter((theme) => {
      const category = filter === "all"
        || (filter === "pro" && theme.edition === "pro")
        || (filter !== "pro" && theme.edition === "standard" && theme.mode === filter);
      if (!category) return false;
      return !keyword || [theme.name, theme.description, theme.edition, theme.mode]
        .join(" ")
        .toLocaleLowerCase("zh-CN")
        .includes(keyword);
    });
  }, [filter, query, themes]);

  const applyTheme = async (theme: Theme) => {
    if (!connection.connected || !connection.runtimeCapable || applyingId) return;
    setApplyingId(theme.id);
    setNotice(`正在应用“${theme.name}”…`);
    try {
      const response = await fetch(`${API_ROOT}/api/themes/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId: theme.id }),
      });
      const body = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "月海助手没有完成请求");
      setConnection((current) => ({ ...current, activeThemeId: theme.id }));
      setNotice(`“${theme.name}”已应用，Codex 无需重启。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "应用失败，请确认月海版仍在运行");
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <section className="themes-section" id="themes" aria-labelledby="themes-title">
      <div className="gallery-toolbar">
        <div>
          <p className="section-kicker">主题墙</p>
          <h2 id="themes-title">找到适合今天的工作氛围。</h2>
        </div>
        <div className={`connection-status ${connection.connected ? "is-connected" : ""}`}>
          <span aria-hidden="true" />
          <div><strong>{connection.connected ? "Codex 已连接" : "Codex 未连接"}</strong><small>{connection.message}</small></div>
        </div>
      </div>

      <div className="gallery-controls">
        <label className="theme-search">
          <span className="visually-hidden">搜索主题</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="搜索主题或使用场景" />
        </label>
        <div className="filter-list" aria-label="筛选主题">
          {(["all", "light", "dark", "pro"] as const).map((value) => (
            <button
              className={filter === value ? "is-active" : ""}
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {{ all: "全部", light: "浅色", dark: "深色", pro: "Pro" }[value]}
            </button>
          ))}
        </div>
      </div>

      <p className="gallery-result" aria-live="polite">
        {notice || `显示 ${visibleThemes.length} 个主题`}
      </p>

      <div className="theme-gallery">
        {visibleThemes.map((theme) => {
          const isActive = connection.activeThemeId === theme.id;
          const isApplying = applyingId === theme.id;
          return (
            <article className="theme-card" key={theme.id}>
              <div className="theme-preview" style={{ background: theme.previewGradient }}>
                {theme.previewImage ? <img src={theme.previewImage.replace("./", "/")} alt="" /> : null}
                <span className="theme-edition">{theme.edition === "pro" ? "精选 · Pro" : `渐变 · ${theme.mode === "dark" ? "深色" : "浅色"}`}</span>
                <div className={`mock-window ${theme.mode}`} aria-hidden="true">
                  <div className="mock-titlebar"><i />Codex · {theme.name}</div>
                  <div className="mock-shell">
                    <aside><span /><span /><span /></aside>
                    <div><b>Build a product people remember</b><span /><span /><em /></div>
                  </div>
                </div>
              </div>
              <div className="theme-card__footer">
                <div><h3>{theme.name}</h3><p>{theme.description}</p></div>
                <button
                  type="button"
                  onClick={() => void applyTheme(theme)}
                  disabled={!connection.connected || !connection.runtimeCapable || Boolean(applyingId) || isActive}
                >
                  {isApplying ? "应用中…" : isActive ? "正在使用" : connection.connected ? "应用" : "连接后应用"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
