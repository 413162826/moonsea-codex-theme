const HEX_COLOR = /^#[0-9A-F]{6}$/;

const mix = (foreground, amount, background) =>
  `color-mix(in oklab, ${foreground} ${amount}%, ${background})`;

const alpha = (color, opacity) =>
  `rgb(from ${color} r g b / ${opacity})`;

export function createGradientPalette({ mode, surface, ink, accent }) {
  if (!["light", "dark"].includes(mode)) {
    throw new Error(`渐变壁纸模式无效：${mode}`);
  }
  for (const [name, value] of Object.entries({ surface, ink, accent })) {
    if (!HEX_COLOR.test(value)) throw new Error(`渐变壁纸颜色 ${name} 无效`);
  }

  const dark = mode === "dark";
  const sidebarBase = mix(surface, dark ? 82 : 91, ink);
  const controlBase = mix(surface, dark ? 88 : 96, ink);
  const raisedBase = mix(surface, dark ? 88 : 94, ink);
  const detailBase = mix(surface, dark ? 78 : 88, ink);
  const shadowColor = dark ? surface : ink;

  return {
    scheme: mode,
    ink,
    muted: mix(ink, 72, surface),
    faint: mix(ink, 55, surface),
    panel: alpha(surface, "var(--moonsea-main-alpha)"),
    panelStrong: alpha(raisedBase, "0.94"),
    panelOpaque: mix(surface, dark ? 86 : 92, ink),
    sidebar: alpha(sidebarBase, "var(--moonsea-sidebar-alpha)"),
    control: alpha(controlBase, "var(--moonsea-control-alpha)"),
    hover: alpha(accent, dark ? "0.18" : "0.14"),
    border: alpha(ink, dark ? "0.24" : "0.20"),
    borderLight: alpha(ink, dark ? "0.17" : "0.14"),
    borderHeavy: alpha(ink, dark ? "0.32" : "0.27"),
    accent,
    accentSoft: alpha(accent, dark ? "0.18" : "0.14"),
    accentHover: alpha(accent, dark ? "0.25" : "0.20"),
    accentActive: alpha(accent, dark ? "0.31" : "0.26"),
    surfaceEdgeTint: alpha(dark ? surface : ink, dark ? "0.30" : "0.10"),
    elevationEdgeTint: alpha(shadowColor, dark ? "0.48" : "0.22"),
    titlebarButtonInk: ink,
    titlebarButtonSurface: alpha(controlBase, dark ? "0.92" : "0.88"),
    titlebarButtonSurfaceHover: alpha(
      mix(surface, dark ? 68 : 82, accent),
      "0.95",
    ),
    titlebarButtonSurfaceActive: alpha(
      mix(surface, dark ? 74 : 86, accent),
      "0.98",
    ),
    titlebarButtonBorder: alpha(ink, dark ? "0.36" : "0.28"),
    readingSurface: alpha(raisedBase, dark ? "0.78" : "0.82"),
    readingSurfaceStrong: alpha(raisedBase, "0.96"),
    readingDetail: alpha(detailBase, dark ? "0.84" : "0.78"),
    selection: alpha(accent, dark ? "0.40" : "0.30"),
    toggleTrack: alpha(ink, dark ? "0.46" : "0.28"),
    highlight: alpha(ink, dark ? "0.12" : "0.08"),
    wallpaperVignette: dark
      ? `radial-gradient(ellipse at 0 0, ${alpha(surface, "0.56")}, transparent 25%)`
      : `radial-gradient(ellipse at 0 0, ${alpha(surface, "0.24")}, transparent 28%)`,
    wallpaperProtection: dark
      ? `linear-gradient(90deg, ${alpha(surface, "0.48")}, ${alpha(surface, "0.08")} 46%, ${alpha(surface, "0.20")})`
      : `linear-gradient(90deg, ${alpha(surface, "0.34")}, ${alpha(surface, "0.05")} 46%, ${alpha(surface, "0.16")})`,
    wallpaperFloor: `linear-gradient(0deg, ${alpha(surface, dark ? "0.30" : "0.18")}, transparent 54%)`,
    textShadow: dark
      ? `0 1px 12px ${alpha(surface, "0.36")}`
      : `0 1px 10px ${alpha(surface, "0.44")}`,
    readingTextShadow: dark
      ? `0 1px 7px ${alpha(surface, "0.58")}`
      : `0 1px 7px ${alpha(surface, "0.56")}`,
    shadow: `0 10px 30px ${alpha(shadowColor, dark ? "0.34" : "0.16")}`,
    shadowDeep: `0 18px 48px ${alpha(shadowColor, dark ? "0.52" : "0.24")}`,
  };
}
