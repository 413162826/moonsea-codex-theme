import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { STANDARD_THEMES } from "../src/theme-catalog.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");

function toRgb(hex) {
  return hex.slice(1).match(/../g).map((part) => Number.parseInt(part, 16) / 255);
}

function luminance(hex) {
  return toRgb(hex)
    .map((channel) => (
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4
    ))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrastRatio(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test("普通主题形成完整且克制的渐变壁纸系统", () => {
  assert.equal(STANDARD_THEMES.length, 16);
  assert.equal(STANDARD_THEMES.filter((theme) => theme.mode === "light").length, 8);
  assert.equal(STANDARD_THEMES.filter((theme) => theme.mode === "dark").length, 8);
  assert.equal(new Set(STANDARD_THEMES.map((theme) => theme.id)).size, STANDARD_THEMES.length);

  for (const theme of STANDARD_THEMES) {
    const { runtime } = theme;

    assert.match(theme.previewGradient, /gradient\(/, `${theme.name} 官网预览必须使用渐变层次`);
    assert.equal(Object.hasOwn(theme, "patch"), false, `${theme.name} 不应再传官方颜色 patch`);
    assert.equal(runtime.backgroundGradient, theme.previewGradient, `${theme.name} 封面与实际渐变必须同源`);
    assert.equal(runtime.tier, "standard");
    assert.equal(runtime.layout, "immersive");
    assert.equal(runtime.palette.scheme, theme.mode);
    assert.match(runtime.palette.ink, /^#[0-9A-F]{6}$/);
    assert.match(runtime.palette.accent, /^#[0-9A-F]{6}$/);
    assert.match(runtime.palette.panel, /var\(--moonsea-main-alpha\)/);
    assert.ok(
      contrastRatio(runtime.palette.ink, theme.preview[0]) >= 7,
      `${theme.name} 的正文与主要底色需要保持高可读性`,
    );
  }
});

test("新增普通主题用不同渐变构图忠实呈现实际壁纸", () => {
  const additions = STANDARD_THEMES.filter((theme) => [
    "tundra-green",
    "distant-ridge",
    "morning-frost",
    "pine-shadow",
    "star-ink",
    "dusk-harbor",
    "glacier-cyan",
    "rain-slate",
    "celadon-mist",
    "polar-night",
    "violet-tide",
    "storm-cobalt",
  ].includes(theme.id));

  assert.equal(additions.length, 12);
  assert.ok(additions.some((theme) => theme.previewGradient.startsWith("conic-gradient(")));
  assert.ok(additions.some((theme) => theme.previewGradient.startsWith("linear-gradient(")));
  assert.ok(additions.some((theme) => theme.previewGradient.startsWith("radial-gradient(")));

  for (const theme of additions) {
    assert.equal(theme.runtime.backgroundGradient, theme.previewGradient);
    assert.ok(theme.preview.includes(theme.runtime.palette.accent), `${theme.name} 预览必须包含真实强调色`);
    assert.ok(theme.preview.includes(theme.runtime.palette.ink), `${theme.name} 预览必须包含真实文字色`);
    assert.equal(Object.hasOwn(theme.runtime, "wallpaper"), false);
  }
});

test("普通与 Pro 壁纸共用交界算法并由各自调色板控制强度", () => {
  const themeCss = fs.readFileSync(path.join(projectRoot, "theme", "static", "theme.css"), "utf8");
  const runtime = fs.readFileSync(path.join(projectRoot, "theme", "static", "theme.js"), "utf8");

  assert.match(themeCss, /--moonsea-sidebar-top-blend-height:\s*12px/);
  assert.match(themeCss, /--moonsea-main-top-blend-height:\s*32px/);
  assert.match(themeCss, /--moonsea-surface-blend-width:\s*32px/);
  assert.match(themeCss, /main\.main-surface::before[\s\S]*linear-gradient\(90deg/);
  assert.match(themeCss, /main\.main-surface::after[\s\S]*inset:\s*var\(--height-toolbar\)[\s\S]*linear-gradient\(180deg/);
  assert.match(themeCss, /nav\[aria-label\]::before[\s\S]*linear-gradient\(180deg/);
  assert.match(themeCss, /main\.main-surface\s*\{[\s\S]*box-shadow:\s*none\s*!important/);
  assert.match(themeCss, /header\.app-header-tint\s*\{[\s\S]*background:\s*transparent\s*!important/);
  assert.match(themeCss, /--elevation-prominent:[\s\S]*--moonsea-elevation-edge-tint/);
  assert.match(themeCss, /body::before[\s\S]*--moonsea-wallpaper-vignette/);
  assert.match(themeCss, /body::before[\s\S]*--moonsea-wallpaper-protection/);
  assert.match(themeCss, /body::before[\s\S]*--moonsea-wallpaper-floor/);
  assert.match(themeCss, /#codex-moonsea-motion-layer[\s\S]*pointer-events:\s*none/);
  assert.match(themeCss, /#codex-moonsea-controls\s*\{[\s\S]*display:\s*contents/);
  assert.match(themeCss, /\.moonsea-controls__dock[\s\S]*z-index:\s*2147483000/);
  assert.match(themeCss, /\.moonsea-motion-soft[\s\S]*translate3d/);
  assert.match(themeCss, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*:not\(\.moonsea-motion-override-reduced\)[\s\S]*transform:\s*none/);
  assert.match(runtime, /url\("app:\/\/-\/moonsea\/wallpapers\/\$\{runtime\.wallpaper\}"\)/);
  assert.match(runtime, /runtime\.backgroundGradient/);
  assert.match(runtime, /surfaceEdgeTint:\s*"--moonsea-surface-edge-tint"/);
  assert.match(runtime, /elevationEdgeTint:\s*"--moonsea-elevation-edge-tint"/);
  assert.doesNotMatch(runtime, /--moonsea-(?:sidebar-top|main-top|surface-blend-width)/);
});
