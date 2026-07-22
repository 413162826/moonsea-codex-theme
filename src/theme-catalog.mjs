const CODE_FONT_STACK = 'ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

const standardThemes = [
  {
    id: "moon-white",
    name: "月白",
    description: "冷白底与深青字，适合长时间阅读",
    edition: "standard",
    mode: "light",
    preview: ["#F7F9FA", "#E2EAED", "#176E83", "#17272F"],
    previewGradient: "radial-gradient(circle at 22% 18%, #FFFFFF 0 16%, transparent 46%), linear-gradient(145deg, #F7FAFB 0%, #D7E6E9 58%, #8AB5BE 100%)",
    patch: {
      accent: "#176E83",
      surface: "#F7F9FA",
      ink: "#17272F",
      contrast: 32,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#1F7552",
        diffRemoved: "#B13F4A",
        skill: "#6752A2",
      },
    },
  },
  {
    id: "mist-blue",
    name: "潮雾",
    description: "蓝灰层次更明确，适合多面板工作",
    edition: "standard",
    mode: "light",
    preview: ["#E3EDF2", "#CADAE2", "#2A678B", "#132934"],
    previewGradient: "radial-gradient(circle at 78% 18%, #F4FBFD 0 12%, transparent 44%), linear-gradient(145deg, #E7F2F6 0%, #B6D1DB 55%, #568AA1 100%)",
    patch: {
      accent: "#2A678B",
      surface: "#E3EDF2",
      ink: "#132934",
      contrast: 42,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#176D4F",
        diffRemoved: "#A93E49",
        skill: "#62519B",
      },
    },
  },
  {
    id: "deep-sea",
    name: "深海",
    description: "深蓝底与海青强调，适合夜间专注",
    edition: "standard",
    mode: "dark",
    preview: ["#0D1A21", "#19303A", "#60B2C1", "#E5EEF1"],
    previewGradient: "radial-gradient(circle at 78% 20%, #397687 0 8%, transparent 42%), linear-gradient(145deg, #122A34 0%, #0A1820 58%, #040B10 100%)",
    patch: {
      accent: "#60B2C1",
      surface: "#0D1A21",
      ink: "#E5EEF1",
      contrast: 44,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#69C79B",
        diffRemoved: "#F1848C",
        skill: "#C1A2E7",
      },
    },
  },
  {
    id: "ink-night",
    name: "夜航",
    description: "中性墨黑与月蓝强调，适合低光环境",
    edition: "standard",
    mode: "dark",
    preview: ["#171D24", "#282F39", "#8BA9D6", "#E9EEF2"],
    previewGradient: "radial-gradient(circle at 20% 20%, #405A7B 0 10%, transparent 40%), linear-gradient(145deg, #28313E 0%, #151B23 60%, #090D12 100%)",
    patch: {
      accent: "#8BA9D6",
      surface: "#171D24",
      ink: "#E9EEF2",
      contrast: 36,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#72C69D",
        diffRemoved: "#F08B91",
        skill: "#C0A6DB",
      },
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
  if (theme.patch.fonts?.ui !== null || typeof theme.patch.fonts?.code !== "string") {
    throw new Error("主题字体无效");
  }
  for (const key of ["diffAdded", "diffRemoved", "skill"]) {
    if (!HEX_COLOR.test(theme.patch.semanticColors?.[key] ?? "")) {
      throw new Error(`主题语义颜色 ${key} 无效`);
    }
  }
  if (!Array.isArray(theme.preview) || theme.preview.length !== 4 || theme.preview.some((color) => !HEX_COLOR.test(color))) {
    throw new Error("主题预览色无效");
  }
  if (typeof theme.previewGradient !== "string" || !theme.previewGradient.includes("gradient(") || /url\(|;/i.test(theme.previewGradient)) {
    throw new Error("主题预览渐变无效");
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
    previewGradient: theme.previewGradient,
  };
}
