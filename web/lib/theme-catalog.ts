import catalog from "../public/catalog.json";
import type { PreviewTheme } from "../app/codex-preview";

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
