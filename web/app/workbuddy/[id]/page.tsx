import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_URL } from "../../../lib/site";
import { getThemeWithUploads } from "../../../lib/theme-catalog";
import { ProCodexPreview, StandardCodexPreview } from "../../codex-preview";
import { SiteFooter, SiteHeader } from "../../site-chrome";
import { ThemeActions } from "../../themes/[id]/theme-actions";

type ThemePageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ThemePageProps): Promise<Metadata> {
  const { id } = await params;
  const theme = await getThemeWithUploads(env.DB, id);
  if (!theme) return {};

  const title = `${theme.name} Codex 主题`;
  const description = `${theme.description}。下载安装 WorkBuddy 版后，可从网页直接应用。`;
  const url = `/workbuddy/${theme.id}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
    twitter: { title, description },
  };
}

export default async function ThemePage({ params }: ThemePageProps) {
  const { id } = await params;
  const theme = await getThemeWithUploads(env.DB, id);
  if (!theme) notFound();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: theme.name,
    description: theme.description,
    isAccessibleForFree: true,
    url: new URL(`/workbuddy/${theme.id}`, SITE_URL).toString(),
  };

  return (
    <div className="themes-shell">
      <SiteHeader tone="workbuddy" />
      <main className="theme-detail">
        <div
          className={`theme-detail__preview ${theme.edition === "pro" ? "is-pro" : ""}`}
          style={{ background: theme.previewGradient }}
        >
          {theme.edition === "pro"
            ? <ProCodexPreview theme={theme} />
            : <StandardCodexPreview theme={theme} />}
        </div>
        <div className="theme-detail__copy">
          <p className="section-kicker">
            {theme.edition === "pro" ? "精选 · PRO" : `免费渐变 · ${theme.mode === "dark" ? "深色" : "浅色"}`}
          </p>
          <h1>{theme.name}</h1>
          <p>{theme.description}。打开 WorkBuddy Codex 后，即可从网页直接应用。</p>
          <ThemeActions themeId={theme.id} basePath="/workbuddy" />
          <Link className="theme-detail__back" href="/workbuddy">返回主题墙</Link>
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </main>
      <SiteFooter tone="workbuddy" />
    </div>
  );
}
