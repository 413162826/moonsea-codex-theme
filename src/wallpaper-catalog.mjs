const HEX_COLOR = /^#[0-9A-F]{6}$/;
const SAFE_ASSET_NAME = /^[a-z0-9-]+\.(?:avif|jpe?g|png|webp)$/;
const PALETTE_COLOR_KEYS = [
  "ink",
  "muted",
  "faint",
  "panel",
  "panelStrong",
  "panelOpaque",
  "sidebar",
  "control",
  "hover",
  "border",
  "borderLight",
  "borderHeavy",
  "accent",
  "accentSoft",
  "accentHover",
  "accentActive",
  "surfaceEdgeTint",
  "elevationEdgeTint",
  "titlebarButtonInk",
  "titlebarButtonSurface",
  "titlebarButtonSurfaceHover",
  "titlebarButtonSurfaceActive",
  "titlebarButtonBorder",
  "readingSurface",
  "readingSurfaceStrong",
  "readingDetail",
  "selection",
  "toggleTrack",
  "highlight",
];
const PALETTE_GRADIENT_KEYS = [
  "wallpaperVignette",
  "wallpaperProtection",
  "wallpaperFloor",
];
const PALETTE_EFFECT_KEYS = [
  "textShadow",
  "readingTextShadow",
  "shadow",
  "shadowDeep",
];

const wallpapers = [
  {
    id: "tide-dragon-realm",
    name: "潮汐龙境",
    description: "月海壁纸、透明表面与沉浸式布局",
    file: "tide-dragon-realm.png",
    previewFile: "tide-dragon-realm.webp",
    previewPosition: "50% 46%",
    wallpaperPosition: "50% 48%",
    previewGradient:
      "radial-gradient(circle at 18% 18%, rgba(190, 239, 244, 0.34), transparent 36%), linear-gradient(135deg, rgba(11, 32, 48, 0.08), rgba(7, 24, 43, 0.52))",
    wallpaperGradient:
      "radial-gradient(circle at 18% 16%, oklch(89% 0.08 200 / 0.22), transparent 36%), linear-gradient(90deg, oklch(8% 0.035 242 / 0.46), transparent 46%, oklch(7% 0.03 245 / 0.18))",
    patch: {
      accent: "#527F91",
      surface: "#F5F7F8",
      ink: "#1B2A32",
      contrast: 8,
    },
    palette: {
      scheme: "dark",
      ink: "oklch(96% 0.018 230)",
      muted: "oklch(82% 0.04 225)",
      faint: "oklch(72% 0.035 225)",
      panel: "oklch(18% 0.045 243 / var(--moonsea-main-alpha))",
      panelStrong: "oklch(16% 0.045 244 / 0.94)",
      panelOpaque: "oklch(19% 0.045 243)",
      sidebar: "oklch(14% 0.04 244 / var(--moonsea-sidebar-alpha))",
      control: "oklch(15% 0.045 243 / var(--moonsea-control-alpha))",
      hover: "oklch(72% 0.09 222 / 0.16)",
      border: "oklch(82% 0.055 225 / 0.22)",
      borderLight: "oklch(82% 0.055 225 / 0.17)",
      borderHeavy: "oklch(82% 0.055 225 / 0.29)",
      accent: "oklch(82% 0.12 155)",
      accentSoft: "oklch(70% 0.08 220 / 0.16)",
      accentHover: "oklch(72% 0.09 220 / 0.21)",
      accentActive: "oklch(68% 0.09 220 / 0.25)",
      surfaceEdgeTint: "oklch(7% 0.028 244 / 0.20)",
      elevationEdgeTint: "oklch(6% 0.025 245 / 0.38)",
      titlebarButtonInk: "oklch(97% 0.016 225)",
      titlebarButtonSurface: "oklch(32% 0.055 236 / 0.92)",
      titlebarButtonSurfaceHover: "oklch(44% 0.075 225 / 0.94)",
      titlebarButtonSurfaceActive: "oklch(38% 0.07 228 / 0.98)",
      titlebarButtonBorder: "oklch(94% 0.035 225 / 0.42)",
      readingSurface: "oklch(13% 0.035 244 / 0.72)",
      readingSurfaceStrong: "oklch(11% 0.035 244 / 0.94)",
      readingDetail: "oklch(20% 0.04 240 / 0.76)",
      selection: "oklch(73% 0.11 211 / 0.42)",
      toggleTrack: "oklch(50% 0.035 230 / 0.58)",
      highlight: "oklch(100% 0 0 / 0.14)",
      wallpaperVignette:
        "radial-gradient(ellipse at 0 0, oklch(8% 0.025 245 / 0.72), transparent 22%)",
      wallpaperProtection:
        "linear-gradient(90deg, oklch(10% 0.035 245 / 0.48), oklch(11% 0.03 245 / 0.09) 44%, oklch(10% 0.03 245 / 0.22))",
      wallpaperFloor:
        "linear-gradient(0deg, oklch(9% 0.03 245 / 0.22), transparent 54%)",
      textShadow: "0 1px 12px oklch(7% 0.025 245 / 0.24)",
      readingTextShadow: "0 1px 7px oklch(5% 0.02 245 / 0.52)",
      shadow: "0 10px 30px oklch(4% 0.025 245 / 0.26)",
      shadowDeep: "0 18px 48px oklch(5% 0.025 245 / 0.46)",
    },
  },
  {
    id: "mint-academy",
    draft: true,
    name: "薄荷学园",
    description: "贝壳白、薄荷绿与柔和拼色，清爽但不寡淡",
    file: "mint-academy.png",
    previewFile: "mint-academy.webp",
    previewPosition: "50% 50%",
    wallpaperPosition: "50% 50%",
    previewGradient:
      "linear-gradient(135deg, rgba(255, 250, 240, 0.04), rgba(31, 89, 76, 0.08))",
    wallpaperGradient:
      "radial-gradient(circle at 52% 42%, oklch(98% 0.018 90 / 0.08), transparent 44%), linear-gradient(90deg, oklch(33% 0.055 165 / 0.08), transparent 38%, oklch(94% 0.04 100 / 0.05))",
    patch: {
      accent: "#216B5B",
      surface: "#F6F0E6",
      ink: "#252823",
      contrast: 8,
    },
    palette: {
      scheme: "light",
      ink: "oklch(28% 0.025 145)",
      muted: "oklch(43% 0.035 155)",
      faint: "oklch(55% 0.03 150)",
      panel: "oklch(96% 0.022 92 / var(--moonsea-main-alpha))",
      panelStrong: "oklch(96% 0.022 92 / 0.94)",
      panelOpaque: "oklch(96% 0.022 92)",
      sidebar: "oklch(91% 0.04 155 / var(--moonsea-sidebar-alpha))",
      control: "oklch(98% 0.018 92 / var(--moonsea-control-alpha))",
      hover: "oklch(55% 0.085 158 / 0.16)",
      border: "oklch(45% 0.055 158 / 0.24)",
      borderLight: "oklch(45% 0.055 158 / 0.16)",
      borderHeavy: "oklch(38% 0.065 158 / 0.31)",
      accent: "oklch(43% 0.095 161)",
      accentSoft: "oklch(69% 0.09 158 / 0.18)",
      accentHover: "oklch(62% 0.11 158 / 0.24)",
      accentActive: "oklch(54% 0.12 158 / 0.30)",
      surfaceEdgeTint: "oklch(34% 0.06 160 / 0.13)",
      elevationEdgeTint: "oklch(34% 0.06 160 / 0.22)",
      titlebarButtonInk: "oklch(28% 0.035 155)",
      titlebarButtonSurface: "oklch(98% 0.018 92 / 0.86)",
      titlebarButtonSurfaceHover: "oklch(90% 0.05 154 / 0.94)",
      titlebarButtonSurfaceActive: "oklch(85% 0.07 154 / 0.98)",
      titlebarButtonBorder: "oklch(42% 0.065 158 / 0.34)",
      readingSurface: "oklch(98% 0.018 92 / 0.80)",
      readingSurfaceStrong: "oklch(97% 0.022 92 / 0.96)",
      readingDetail: "oklch(91% 0.04 154 / 0.82)",
      selection: "oklch(68% 0.11 157 / 0.32)",
      toggleTrack: "oklch(65% 0.035 150 / 0.45)",
      highlight: "oklch(100% 0 0 / 0.58)",
      wallpaperVignette:
        "radial-gradient(ellipse at 0 0, oklch(35% 0.055 160 / 0.12), transparent 24%)",
      wallpaperProtection:
        "linear-gradient(90deg, oklch(96% 0.025 100 / 0.20), oklch(98% 0.018 90 / 0.05) 44%, oklch(95% 0.03 100 / 0.12))",
      wallpaperFloor:
        "linear-gradient(0deg, oklch(34% 0.05 160 / 0.08), transparent 50%)",
      textShadow: "0 1px 10px oklch(100% 0 0 / 0.30)",
      readingTextShadow: "0 1px 7px oklch(100% 0 0 / 0.46)",
      shadow: "0 10px 30px oklch(31% 0.045 155 / 0.18)",
      shadowDeep: "0 18px 48px oklch(31% 0.045 155 / 0.24)",
    },
  },
  {
    id: "vinyl-citrus",
    draft: true,
    name: "黑胶柑橘",
    description: "暖黑底、芥末黄与柑橘红，夜间也有鲜明节奏",
    file: "vinyl-citrus.png",
    previewFile: "vinyl-citrus.webp",
    previewPosition: "50% 50%",
    wallpaperPosition: "50% 50%",
    previewGradient:
      "linear-gradient(135deg, rgba(26, 24, 21, 0.04), rgba(230, 177, 26, 0.08))",
    wallpaperGradient:
      "radial-gradient(circle at 72% 22%, oklch(80% 0.13 88 / 0.08), transparent 36%), linear-gradient(90deg, oklch(12% 0.018 65 / 0.22), transparent 42%, oklch(11% 0.02 45 / 0.12))",
    patch: {
      accent: "#8A5A00",
      surface: "#F2EADD",
      ink: "#24211D",
      contrast: 8,
    },
    palette: {
      scheme: "dark",
      ink: "oklch(93% 0.028 85)",
      muted: "oklch(76% 0.035 78)",
      faint: "oklch(64% 0.03 72)",
      panel: "oklch(17% 0.018 58 / var(--moonsea-main-alpha))",
      panelStrong: "oklch(16% 0.018 55 / 0.95)",
      panelOpaque: "oklch(19% 0.02 58)",
      sidebar: "oklch(13% 0.018 55 / var(--moonsea-sidebar-alpha))",
      control: "oklch(18% 0.02 58 / var(--moonsea-control-alpha))",
      hover: "oklch(80% 0.14 86 / 0.15)",
      border: "oklch(82% 0.055 84 / 0.22)",
      borderLight: "oklch(82% 0.055 84 / 0.15)",
      borderHeavy: "oklch(82% 0.07 84 / 0.30)",
      accent: "oklch(80% 0.15 87)",
      accentSoft: "oklch(80% 0.14 86 / 0.16)",
      accentHover: "oklch(82% 0.15 84 / 0.23)",
      accentActive: "oklch(75% 0.16 74 / 0.28)",
      surfaceEdgeTint: "oklch(8% 0.014 55 / 0.24)",
      elevationEdgeTint: "oklch(7% 0.012 55 / 0.42)",
      titlebarButtonInk: "oklch(96% 0.025 86)",
      titlebarButtonSurface: "oklch(27% 0.025 58 / 0.92)",
      titlebarButtonSurfaceHover: "oklch(38% 0.055 67 / 0.96)",
      titlebarButtonSurfaceActive: "oklch(32% 0.06 62 / 0.98)",
      titlebarButtonBorder: "oklch(85% 0.08 86 / 0.36)",
      readingSurface: "oklch(14% 0.018 55 / 0.76)",
      readingSurfaceStrong: "oklch(12% 0.016 52 / 0.95)",
      readingDetail: "oklch(22% 0.025 60 / 0.82)",
      selection: "oklch(80% 0.15 87 / 0.38)",
      toggleTrack: "oklch(48% 0.025 66 / 0.62)",
      highlight: "oklch(100% 0 0 / 0.12)",
      wallpaperVignette:
        "radial-gradient(ellipse at 0 0, oklch(7% 0.012 55 / 0.74), transparent 23%)",
      wallpaperProtection:
        "linear-gradient(90deg, oklch(9% 0.015 55 / 0.50), oklch(12% 0.018 58 / 0.10) 44%, oklch(9% 0.015 48 / 0.26))",
      wallpaperFloor:
        "linear-gradient(0deg, oklch(8% 0.014 52 / 0.28), transparent 54%)",
      textShadow: "0 1px 12px oklch(5% 0.012 52 / 0.32)",
      readingTextShadow: "0 1px 7px oklch(4% 0.012 52 / 0.58)",
      shadow: "0 10px 30px oklch(4% 0.012 52 / 0.34)",
      shadowDeep: "0 18px 48px oklch(4% 0.012 52 / 0.54)",
    },
  },
];

export function validateWallpaper(wallpaper) {
  if (!wallpaper || !/^[a-z0-9-]+$/.test(wallpaper.id) || !wallpaper.name) {
    throw new Error("壁纸标识无效");
  }
  if (!SAFE_ASSET_NAME.test(wallpaper.file) || !/^[a-z0-9-]+\.webp$/.test(wallpaper.previewFile)) {
    throw new Error(`壁纸文件名无效：${wallpaper.id}`);
  }
  if (!wallpaper.description || !/^\d+% \d+%$/.test(wallpaper.previewPosition) || !/^\d+% \d+%$/.test(wallpaper.wallpaperPosition)) {
    throw new Error(`壁纸显示位置无效：${wallpaper.id}`);
  }
  for (const [label, gradient] of [
    ["预览渐变", wallpaper.previewGradient],
    ["运行时渐变", wallpaper.wallpaperGradient],
  ]) {
    if (typeof gradient !== "string" || !gradient.includes("gradient(") || /url\(|;/i.test(gradient)) {
      throw new Error(`${label}无效：${wallpaper.id}`);
    }
  }
  for (const key of ["accent", "surface", "ink"]) {
    if (!HEX_COLOR.test(wallpaper.patch?.[key] ?? "")) {
      throw new Error(`壁纸主题颜色 ${key} 无效：${wallpaper.id}`);
    }
  }
  if (!Number.isInteger(wallpaper.patch.contrast) || wallpaper.patch.contrast < 0 || wallpaper.patch.contrast > 100) {
    throw new Error(`壁纸主题对比度无效：${wallpaper.id}`);
  }
  if (!["light", "dark"].includes(wallpaper.palette?.scheme)) {
    throw new Error(`壁纸主题配色模式无效：${wallpaper.id}`);
  }
  for (const key of [...PALETTE_COLOR_KEYS, ...PALETTE_EFFECT_KEYS]) {
    const value = wallpaper.palette[key];
    if (typeof value !== "string" || !value.trim() || /[;{}]|url\(/i.test(value)) {
      throw new Error(`壁纸主题配色 ${key} 无效：${wallpaper.id}`);
    }
  }
  for (const key of PALETTE_GRADIENT_KEYS) {
    const value = wallpaper.palette[key];
    if (typeof value !== "string" || !value.includes("gradient(") || /[;{}]|url\(/i.test(value)) {
      throw new Error(`壁纸主题渐变 ${key} 无效：${wallpaper.id}`);
    }
  }
  return wallpaper;
}

for (const wallpaper of wallpapers) validateWallpaper(wallpaper);
if (new Set(wallpapers.map(({ id }) => id)).size !== wallpapers.length) {
  throw new Error("壁纸标识不能重复");
}
if (new Set(wallpapers.map(({ file }) => file)).size !== wallpapers.length) {
  throw new Error("壁纸文件不能重复");
}

export const WALLPAPERS = Object.freeze(
  wallpapers
    .filter((wallpaper) => !wallpaper.draft)
    .map((wallpaper) => Object.freeze(wallpaper)),
);

export const WALLPAPER_DRAFTS = Object.freeze(
  wallpapers
    .filter((wallpaper) => wallpaper.draft)
    .map((wallpaper) => Object.freeze(wallpaper)),
);
