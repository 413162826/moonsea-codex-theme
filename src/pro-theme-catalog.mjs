const proThemes = [
  {
    id: "tide-dragon-realm",
    name: "潮汐龙境",
    description: "月海壁纸、动态光尘与沉浸式布局",
    edition: "pro",
    mode: "light",
    preview: ["#E9F1F4", "#88AFC0", "#31566B", "#172C3B"],
    patch: {
      accent: "#527F91",
      surface: "#F5F7F8",
      ink: "#1B2A32",
      contrast: 8,
      opaqueWindows: true,
    },
    runtime: {
      wallpaper: "dragon-girl.png",
      motion: true,
      layout: "immersive",
    },
  },
];

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
    preview: theme.preview,
  };
}
