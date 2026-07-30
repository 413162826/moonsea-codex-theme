import catalog from "../public/catalog.json";
import type { PreviewTheme } from "../app/codex-preview";
import { listUploadedPublicThemes } from "./uploaded-themes";

export type Theme = PreviewTheme & {
  id: string;
  description: string;
  edition: "standard" | "pro";
  preview?: string[];
};

export const THEMES = Object.freeze(catalog.themes as Theme[]);
export const THEME_IDS = new Set(THEMES.map((theme) => theme.id));

export function getTheme(themeId: string) {
  return THEMES.find((theme) => theme.id === themeId) ?? null;
}

export async function getThemesWithUploads(db: D1Database) {
  return [
    ...THEMES,
    ...(await listUploadedPublicThemes(db)),
  ] satisfies Theme[];
}

export async function getThemeWithUploads(db: D1Database, themeId: string) {
  return (await getThemesWithUploads(db))
    .find((theme) => theme.id === themeId) ?? null;
}
