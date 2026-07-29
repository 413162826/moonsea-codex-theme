import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_URL } from "../../../lib/site";
import { getTheme, THEMES } from "../../../lib/theme-catalog";
import { ProCodexPreview, StandardCodexPreview } from "../../codex-preview";
import { SiteFooter, SiteHeader } from "../../site-chrome";
import { ThemeActions } from "./theme-actions";

type ThemePageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return THEMES.map((theme) => ({ id: theme.id }));
}

export async function generateMetadata({ params }: ThemePageProps): Promise<Metadata> {
  const { id } = await params;
  const theme = getTheme(id);
  if (!theme) return {};

  const title = `${theme.name} Codex 主题`;
  const description = `${theme.description}。下载安装月海版后，可从网页直接应用。`;
  const url = `/themes/${theme.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
    twitter: { title, description },
  };
}

export default async function ThemePage({ params }: ThemePageProps) {
  const { id } = await params;
  const theme = getTheme(id);
  if (!theme) notFound();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: theme.name,
    description: theme.description,
    isAccessibleForFree: theme.edition === "standard",
    url: new URL(`/themes/${theme.id}`, SITE_URL).toString(),
  };

  return (
    <div className="themes-shell">
      <SiteHeader tone="moonsea" />
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
          <p>{theme.description}。打开月海 Codex 后，即可从网页直接应用。</p>
          <ThemeActions themeId={theme.id} />
          <Link className="theme-detail__back" href="/themes">返回主题墙</Link>
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
