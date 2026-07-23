import { WALLPAPERS } from "./wallpaper-catalog.mjs";

const proThemes = WALLPAPERS.map((wallpaper) => ({
  id: wallpaper.id,
  name: wallpaper.name,
  description: wallpaper.description,
  edition: "pro",
  mode: wallpaper.palette.scheme,
  previewImage: `./wallpapers/${wallpaper.previewFile}`,
  previewGradient: wallpaper.previewGradient,
  runtime: {
    wallpaper: wallpaper.file,
    wallpaperName: wallpaper.name,
    wallpaperPosition: wallpaper.wallpaperPosition,
    wallpaperGradient: wallpaper.wallpaperGradient,
    palette: wallpaper.palette,
    layout: "immersive",
    tier: "pro",
  },
}));

export const PRO_THEMES = Object.freeze(
  proThemes.map((theme) => Object.freeze(theme)),
);

export function getProTheme(themeId) {
  const theme = PRO_THEMES.find((item) => item.id === themeId);
  if (!theme) throw new Error(`没有这个 Pro 主题：${themeId}`);
  return theme;
}

export function toPublicProTheme(theme) {
  return {
    id: theme.id,
    name: theme.name,
    description: theme.description,
    edition: theme.edition,
    mode: theme.mode,
    previewImage: theme.previewImage,
    previewGradient: theme.previewGradient,
  };
}
