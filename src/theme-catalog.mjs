const standardThemes = [
  {
    id: "moon-white",
    name: "月白",
    description: "清亮、克制的浅色界面",
    edition: "standard",
    mode: "light",
    preview: ["#F5F8FA", "#DCE9EE", "#397A8C", "#172830"],
    patch: {
      accent: "#397A8C",
      surface: "#F5F8FA",
      ink: "#172830",
      contrast: 7,
      opaqueWindows: true,
    },
  },
  {
    id: "mist-blue",
    name: "雾蓝",
    description: "柔和的蓝灰工作空间",
    edition: "standard",
    mode: "light",
    preview: ["#EEF4F7", "#C9DDE6", "#4C7393", "#192B39"],
    patch: {
      accent: "#4C7393",
      surface: "#EEF4F7",
      ink: "#192B39",
      contrast: 10,
      opaqueWindows: true,
    },
  },
  {
    id: "deep-sea",
    name: "深海",
    description: "低眩光的深蓝夜间界面",
    edition: "standard",
    mode: "dark",
    preview: ["#10212C", "#1C3441", "#63A8B7", "#E9F2F4"],
    patch: {
      accent: "#63A8B7",
      surface: "#10212C",
      ink: "#E9F2F4",
      contrast: 12,
      opaqueWindows: true,
    },
  },
  {
    id: "ink-night",
    name: "墨夜",
    description: "更沉静的中性深色界面",
    edition: "standard",
    mode: "dark",
    preview: ["#171D22", "#293138", "#8AA9B4", "#F0F3F4"],
    patch: {
      accent: "#8AA9B4",
      surface: "#171D22",
      ink: "#F0F3F4",
      contrast: 8,
      opaqueWindows: true,
    },
  },
];

const HEX_COLOR = /^#[0-9A-F]{6}$/;

export function validateStandardTheme(theme) {
  if (!theme || theme.edition !== "standard") {
    throw new Error("只支持普通主题");
  }
  if (!/^[a-z0-9-]+$/.test(theme.id) || !theme.name) {
    throw new Error("主题标识无效");
  }
  if (!new Set(["light", "dark"]).has(theme.mode)) {
    throw new Error("主题模式无效");
  }
  for (const key of ["accent", "surface", "ink"]) {
    if (!HEX_COLOR.test(theme.patch?.[key] ?? "")) {
      throw new Error(`主题颜色 ${key} 无效`);
    }
  }
  if (!Number.isInteger(theme.patch.contrast) || theme.patch.contrast < 0 || theme.patch.contrast > 100) {
    throw new Error("主题对比度无效");
  }
  if (theme.patch.opaqueWindows !== true) {
    throw new Error("普通主题必须保持窗口不透明");
  }
  return theme;
}

for (const theme of standardThemes) validateStandardTheme(theme);

export const STANDARD_THEMES = Object.freeze(
  standardThemes.map((theme) => Object.freeze(theme)),
);

export function getStandardTheme(themeId) {
  const theme = STANDARD_THEMES.find((item) => item.id === themeId);
  if (!theme) throw new Error(`没有这个普通主题：${themeId}`);
  return theme;
}

export function toPublicTheme(theme) {
  return {
    id: theme.id,
    name: theme.name,
    description: theme.description,
    edition: theme.edition,
    mode: theme.mode,
    preview: theme.preview,
  };
}
