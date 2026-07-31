"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CLIENT_TARGETS,
  type ClientTarget,
} from "../lib/client-target";
import type { Theme } from "../lib/theme-catalog";
import { ProCodexPreview, StandardCodexPreview } from "./codex-preview";
import { useClientTarget } from "./use-client-target";

type Connection = {
  connected: boolean;
  runtimeCapable: boolean;
  activeThemeId: string | null;
  message: string;
};

const DISCONNECTED: Connection = Object.freeze({
  connected: false,
  runtimeCapable: false,
  activeThemeId: null,
  message: "未连接",
});

const INITIAL_CONNECTIONS: Record<ClientTarget, Connection> = {
  codex: DISCONNECTED,
  workbuddy: DISCONNECTED,
};

export function ThemeGallery({
  initialThemes,
}: {
  initialThemes: Theme[];
}) {
  const client = useClientTarget();
  const { apiRoot, label: clientLabel } = CLIENT_TARGETS[client];
  const [themes, setThemes] = useState(() => [...initialThemes].reverse());
  const [filter, setFilter] = useState<"all" | "light" | "dark" | "pro">("all");
  const [query, setQuery] = useState("");
  const [connections, setConnections] = useState(INITIAL_CONNECTIONS);
  const connection = connections[client];
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [pendingThemeId, setPendingThemeId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem("moonsea_pending_theme"),
  );
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const loadThemes = async () => {
      const response = await fetch("/api/themes", { cache: "no-store" });
      if (!response.ok) throw new Error("主题清单加载失败");
      const body = await response.json() as Theme[];
      setThemes([...body].reverse());
    };
    void loadThemes().catch((error) => {
      setNotice(error instanceof Error ? error.message : "主题清单加载失败");
    });
  }, []);

  useEffect(() => {
    let active = true;
    const connect = async () => {
      try {
        const response = await fetch(`${apiRoot}/api/status`, { cache: "no-store" });
        const body = await response.json() as {
          connected: boolean;
          runtimeCapable?: boolean;
          themeDeliveryVersion?: number;
          themeId?: string;
          message?: string;
        };
        if (!response.ok || !body.connected) throw new Error(body.message ?? `${clientLabel} 未连接`);
        if (!active) return;
        const runtimeCapable = body.runtimeCapable === true
          && (body.themeDeliveryVersion ?? 0) >= 1;
        setConnections((current) => ({
          ...current,
          [client]: {
            connected: true,
            runtimeCapable,
            activeThemeId: body.themeId ?? null,
            message: runtimeCapable ? "可一键获取并应用" : "需要升级一次月海",
          },
        }));
        const pendingId = window.localStorage.getItem("moonsea_pending_theme");
        const pendingTheme = themes.find((theme) => theme.id === pendingId);
        if (pendingTheme) {
          setPendingThemeId(pendingTheme.id);
          setNotice(
            runtimeCapable
              ? `月海已连接，可以继续应用“${pendingTheme.name}”。`
              : "升级一次月海助手后，今后的新壁纸都能一键应用。",
          );
        }
      } catch {
        if (active) {
          setConnections((current) => ({
            ...current,
            [client]: DISCONNECTED,
          }));
        }
      }
    };
    void connect();
    const timer = window.setInterval(connect, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [apiRoot, client, clientLabel, themes]);

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
    if (applyingId) return;
    if (
      !connection.connected
      || !connection.runtimeCapable
    ) {
      window.localStorage.setItem("moonsea_pending_theme", theme.id);
      setPendingThemeId(theme.id);
      window.location.assign(`/download?client=${encodeURIComponent(client)}&theme=${encodeURIComponent(theme.id)}`);
      return;
    }
    setApplyingId(theme.id);
    setNotice(`正在应用“${theme.name}”…`);
    try {
      const response = await fetch(`${apiRoot}/api/themes/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId: theme.id }),
      });
      const body = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "月海助手没有完成请求");
      setConnections((current) => ({
        ...current,
        [client]: { ...current[client], activeThemeId: theme.id },
      }));
      window.localStorage.removeItem("moonsea_pending_theme");
      setPendingThemeId(null);
      setNotice(`"${theme.name}"已应用，${clientLabel} 无需重启。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "应用失败，请确认月海版仍在运行");
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <section className="themes-section" id="themes" aria-labelledby="themes-title">
      <div className="gallery-toolbar">
        <div className="gallery-intro">
          <p className="section-kicker">主题</p>
          <h1 id="themes-title">选择今天的工作氛围。</h1>
          <p>选择喜欢的主题，月海助手会自动获取并应用到当前目标。</p>
        </div>
        <div className={`connection-status ${connection.connected ? "is-connected" : ""}`}>
          <span aria-hidden="true" />
          <div><strong>{connection.connected ? `${clientLabel} 已连接` : `${clientLabel} 未连接`}</strong><small>{connection.message}</small></div>
        </div>
      </div>

      <div className="gallery-controls">
        <label className="theme-search">
          <span className="visually-hidden">搜索主题</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="搜索主题" />
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
          const canApply = connection.connected
            && connection.runtimeCapable;
          return (
            <article className="theme-card" key={theme.id}>
              <div className={`theme-preview ${theme.edition === "pro" ? "is-pro" : ""}`} style={{ background: theme.previewGradient }}>
                <span className="theme-edition">{theme.edition === "pro" ? "精选 · Pro" : `渐变 · ${theme.mode === "dark" ? "深色" : "浅色"}`}</span>
                {theme.edition === "pro"
                  ? <ProCodexPreview theme={theme} />
                  : <StandardCodexPreview theme={theme} />}
              </div>
              <div className="theme-card__footer">
                <div>
                  <h3>
                    <Link href={`/themes/${theme.id}?client=${client}`}>
                      {theme.name}
                    </Link>
                  </h3>
                  <p>{theme.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void applyTheme(theme)}
                  disabled={Boolean(applyingId) || isActive}
                >
                  {isApplying
                    ? "应用中…"
                    : isActive
                      ? "正在使用"
                      : canApply
                        ? pendingThemeId === theme.id ? "继续应用" : "应用"
                        : connection.connected ? "升级月海后应用" : "下载安装"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
