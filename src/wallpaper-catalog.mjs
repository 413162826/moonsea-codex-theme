const HEX_COLOR = /^#[0-9A-F]{6}$/;
const SAFE_ASSET_NAME = /^[a-z0-9-]+\.(?:avif|jpe?g|png|webp)$/;

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
  wallpapers.map((wallpaper) => Object.freeze(wallpaper)),
);
