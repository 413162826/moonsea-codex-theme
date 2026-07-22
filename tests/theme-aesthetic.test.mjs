import assert from "node:assert/strict";
import test from "node:test";

import { STANDARD_THEMES } from "../src/theme-catalog.mjs";

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

test("普通主题形成完整且克制的官方外观系统", () => {
  assert.equal(STANDARD_THEMES.length, 16);
  assert.equal(STANDARD_THEMES.filter((theme) => theme.mode === "light").length, 8);
  assert.equal(STANDARD_THEMES.filter((theme) => theme.mode === "dark").length, 8);
  assert.equal(new Set(STANDARD_THEMES.map((theme) => theme.id)).size, STANDARD_THEMES.length);

  for (const theme of STANDARD_THEMES) {
    const { patch } = theme;

    assert.match(theme.previewGradient, /gradient\(/, `${theme.name} 官网预览必须使用渐变层次`);
    assert.equal(patch.opaqueWindows, true, `${theme.name} 必须保持窗口不透明`);
    assert.ok(patch.contrast >= 28 && patch.contrast <= 50, `${theme.name} 的面板层级不能泛白或过硬`);
    assert.equal(patch.fonts.ui, null, `${theme.name} 应保留 Codex 官方 UI 字体`);
    assert.match(patch.fonts.code, /ui-monospace/, `${theme.name} 需要跨平台等宽字体栈`);

    assert.ok(
      contrastRatio(patch.ink, patch.surface) >= 9,
      `${theme.name} 的正文与底色需要达到高可读性`,
    );
    assert.ok(
      contrastRatio(patch.accent, patch.surface) >= 4.5,
      `${theme.name} 的按钮与选中态需要达到 WCAG AA`,
    );

    for (const [role, color] of Object.entries(patch.semanticColors)) {
      assert.ok(
        contrastRatio(color, patch.surface) >= 4.5,
        `${theme.name} 的 ${role} 状态色需要在主表面清晰可见`,
      );
    }
  }
});

test("新增普通主题用不同渐变构图忠实预览纯色调色盘", () => {
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
    assert.ok(theme.preview.includes(theme.patch.surface), `${theme.name} 预览必须包含真实底色`);
    assert.ok(theme.preview.includes(theme.patch.accent), `${theme.name} 预览必须包含真实强调色`);
    assert.ok(theme.preview.includes(theme.patch.ink), `${theme.name} 预览必须包含真实文字色`);
    assert.match(theme.patch.surface, /^#[0-9A-F]{6}$/, `${theme.name} 官方表面必须保持纯色`);
  }
});
