import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import {
  isAllowedOrigin,
  parseDevToolsActivePort,
  PUBLIC_SITE_ORIGIN,
} from "../src/manager-core.mjs";
import { getStandardTheme, STANDARD_THEMES } from "../src/theme-catalog.mjs";
import { getProTheme, PRO_THEMES } from "../src/pro-theme-catalog.mjs";

const projectRoot = path.resolve(path.dirname(process.argv[1]), "..");

test("普通主题全部保持不透明", () => {
  assert.ok(STANDARD_THEMES.length >= 4);
  for (const theme of STANDARD_THEMES) {
    assert.equal(theme.edition, "standard");
    assert.equal(theme.patch.opaqueWindows, true);
  }
  assert.equal(getStandardTheme("deep-sea").mode, "dark");
});

test("拒绝不存在的普通主题", () => {
  assert.throws(() => getStandardTheme("unknown"), /没有这个普通主题/);
});

test("Pro 主题固定使用官方浅色不透明基底", () => {
  assert.ok(PRO_THEMES.length >= 1);
  for (const theme of PRO_THEMES) {
    assert.equal(theme.edition, "pro");
    assert.equal(theme.mode, "light");
    assert.equal(theme.patch.opaqueWindows, true);
    assert.equal(theme.runtime.motion, true);
  }
  assert.equal(getProTheme("tide-dragon-realm").runtime.layout, "immersive");
});

test("解析 Codex 随机调试端口", () => {
  assert.deepEqual(parseDevToolsActivePort("32145\n/devtools/browser/test\n"), {
    port: 32145,
    socketPath: "/devtools/browser/test",
  });
  assert.throws(() => parseDevToolsActivePort("0\n"), /调试端口无效/);
});

test("本地助手只接受官网和本机页面", () => {
  assert.equal(isAllowedOrigin(PUBLIC_SITE_ORIGIN), true);
  assert.equal(isAllowedOrigin("http://127.0.0.1:17321"), true);
  assert.equal(isAllowedOrigin("https://example.com"), false);
});

test("普通主题网页不提供透明度控件", () => {
  const html = fs.readFileSync(path.join(projectRoot, "site", "index.html"), "utf8");
  assert.doesNotMatch(html, /type=["']range["']/);
  assert.doesNotMatch(html, /id=["'][^"']*opacity/);
});

test("控制桥等待 Codex 官方动作作用域就绪", () => {
  const bridge = fs.readFileSync(
    path.join(projectRoot, "theme", "runtime", "appearance-bridge.template.js"),
    "utf8",
  );
  assert.match(bridge, /appActions\.scope != null/);
  assert.match(bridge, /getStatus/);
  assert.match(bridge, /applyProTheme/);
  assert.match(bridge, /disableProRuntime/);
});

test("Pro 运行时可以启用并完整退出", () => {
  const runtime = fs.readFileSync(
    path.join(projectRoot, "theme", "static", "theme.js"),
    "utf8",
  );
  assert.match(runtime, /const enable = async/);
  assert.match(runtime, /const disable = \(\) =>/);
  assert.match(runtime, /classList\.remove\(/);
  assert.match(runtime, /codex-moonsea-static-theme/);
  assert.match(runtime, /moonseaProRuntime/);
});

test("官网按系统直下安装包且入口使用通用命名", () => {
  const website = fs.readFileSync(path.join(projectRoot, "site", "app.js"), "utf8");
  assert.match(website, /Moonsea-Codex-Windows-x64\.zip/);
  assert.match(website, /Moonsea-Codex-macOS\.zip/);
  assert.doesNotMatch(website, /releases\/latest["']/);
  assert.match(website, /status\.proCapable === true/);
  assert.match(website, /Pro 主题需要新版月海版/);

  for (const entry of ["Install.cmd", "Uninstall.cmd", "Install.command", "Uninstall.command"]) {
    assert.equal(fs.existsSync(path.join(projectRoot, entry)), true, `${entry} 应存在`);
  }
});
