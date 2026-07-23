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
import { WALLPAPERS } from "../src/wallpaper-catalog.mjs";

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
    assert.equal(Object.hasOwn(theme.runtime, "motion"), false);
    assert.match(theme.previewImage, /^\.\/wallpapers\/[a-z0-9-]+\.webp$/);
    assert.match(theme.previewGradient, /gradient\(/);
    assert.match(theme.runtime.wallpaperGradient, /gradient\(/);
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
  assert.equal(isAllowedOrigin("app://-"), true);
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

test("月海外观状态会跨重启恢复并同步官网选中项", () => {
  const bridge = fs.readFileSync(
    path.join(projectRoot, "theme", "runtime", "appearance-bridge.template.js"),
    "utf8",
  );
  const manager = fs.readFileSync(path.join(projectRoot, "src", "manager-core.mjs"), "utf8");
  const website = fs.readFileSync(path.join(projectRoot, "site", "app.js"), "utf8");

  assert.match(bridge, /codex-moonsea-appearance-state-v1/);
  assert.match(bridge, /restoreSavedAppearance/);
  assert.match(bridge, /saveAppearanceState/);
  assert.match(bridge, /themeId/);
  assert.match(manager, /themeId:\s*bridgeStatus\?\.themeId/);
  assert.match(website, /status\.themeId/);
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
  assert.match(runtime, /applyPackagedWallpaper/);
  assert.match(runtime, /--moonsea-wallpaper-gradient/);
  assert.match(runtime, /url\("app:\/\/-\/moonsea\/wallpapers\/\$\{runtime\.wallpaper\}"\)/);
  assert.doesNotMatch(runtime, /\.\/moonsea\/wallpapers\//);
  assert.match(runtime, /savedWallpaperRecord/);
  assert.match(runtime, /await loadSavedWallpaper\(\)/);
});

test("普通主题与 Pro 主题共用月海助手，透明度仅在 Pro 状态显示", () => {
  const runtime = fs.readFileSync(
    path.join(projectRoot, "theme", "static", "theme.js"),
    "utf8",
  );
  const manager = fs.readFileSync(
    path.join(projectRoot, "src", "manager.mjs"),
    "utf8",
  );
  const managerCore = fs.readFileSync(
    path.join(projectRoot, "src", "manager-core.mjs"),
    "utf8",
  );
  const assistantCss = fs.readFileSync(
    path.join(projectRoot, "theme", "static", "assistant.css"),
    "utf8",
  );
  assert.match(runtime, /月海助手/);
  assert.match(runtime, /data-pro-settings hidden/);
  assert.match(runtime, /当前使用 Codex 官方外观/);
  assert.match(runtime, /moonseaAssistantUpdateBridge/);
  assert.match(runtime, /addEventListener\("dblclick"/);
  assert.match(runtime, /pendingUpdateCommand = "check"/);
  assert.match(runtime, /pendingUpdateCommand = "download"/);
  assert.match(runtime, /重新打开并更新/);
  assert.match(runtime, /正在启动更新程序/);
  assert.match(manager, /exchange\?\.command === "check"/);
  assert.match(manager, /getStatus\(\{ force: true \}\)/);
  assert.match(manager, /updater-\$\{targetVersion\}\.ready/);
  assert.match(manager, /updater-launch\.log/);
  assert.match(manager, /startDownload\(\{ autoInstall: true \}\)/);
  assert.match(managerCore, /const command = bridge\.takeCommand\(\);[\s\S]*if \(!command\) bridge\.setStatus/);
  assert.doesNotMatch(runtime, /data-setting="motion"/);
  assert.doesNotMatch(runtime, /createAmbientMotion|codex-moonsea-ambient|moonsea-motion-/);
  assert.match(assistantCss, /\.moonsea-controls__toggle\.is-update-available::after/);
  assert.match(assistantCss, /prefers-reduced-motion/);
});

test("壁纸目录同时生成官网预览与安装资源", () => {
  assert.ok(WALLPAPERS.length >= 1);
  for (const wallpaper of WALLPAPERS) {
    assert.equal(
      fs.existsSync(path.join(projectRoot, "assets", "wallpapers", wallpaper.file)),
      true,
      `${wallpaper.name} 原图应存在`,
    );
    assert.equal(
      fs.existsSync(path.join(projectRoot, "site", "wallpapers", wallpaper.previewFile)),
      true,
      `${wallpaper.name} 官网预览应存在`,
    );
  }
  const catalog = JSON.parse(fs.readFileSync(path.join(projectRoot, "site", "catalog.json"), "utf8"));
  assert.equal(catalog.catalogVersion, 2);
  assert.equal(catalog.themes.filter(({ edition }) => edition === "pro").length, WALLPAPERS.length);
});

test("官网按系统直下安装包且入口使用通用命名", () => {
  const website = fs.readFileSync(path.join(projectRoot, "site", "app.js"), "utf8");
  const page = fs.readFileSync(path.join(projectRoot, "site", "index.html"), "utf8");
  assert.match(website, /Moonsea-Codex-Windows-x64\.zip/);
  assert.match(website, /Moonsea-Codex-macOS\.zip/);
  assert.doesNotMatch(website, /releases\/latest["']/);
  assert.match(website, /status\.proCapable === true/);
  assert.match(website, /status\.catalogVersion >= 2/);
  assert.match(website, /\.\/catalog\.json/);
  assert.match(website, /theme\.previewImage/);
  assert.match(website, /壁纸主题需要新版月海版/);
  assert.match(website, /\? "需要升级"/);
  assert.match(website, /最后一次手动安装/);
  assert.match(website, /dataset\.themeApply/);
  assert.match(website, /applyTheme\(theme\)/);
  assert.match(website, /应用壁纸/);
  assert.match(website, /当前壁纸/);
  assert.match(website, /壁纸已应用/);
  assert.match(website, /await ensureCatalog\(\)/);
  assert.match(website, /dataset\.themeFilter/);
  assert.doesNotMatch(website, /applySelectedTheme/);
  assert.doesNotMatch(website, /Promise\.all\(\[\s*request\("\/api\/status"\)/);
  assert.match(page, /id="theme-search"/);
  assert.match(page, /data-theme-filter="all"/);
  assert.match(page, /id="theme-gallery"/);
  assert.doesNotMatch(page, /class="performance"/);

  for (const entry of ["Install.cmd", "Uninstall.cmd", "Install.command", "Uninstall.command"]) {
    assert.equal(fs.existsSync(path.join(projectRoot, entry)), true, `${entry} 应存在`);
  }
});

test("Windows 发布脚本兼容非 UTF-8 系统区域的 PowerShell 5.1", () => {
  const scriptsRoot = path.join(projectRoot, "scripts", "windows");
  for (const entry of fs.readdirSync(scriptsRoot).filter((name) => name.endsWith(".ps1"))) {
    const script = fs.readFileSync(path.join(scriptsRoot, entry));
    assert.equal(
      script.every((byte) => byte < 0x80),
      true,
      `${entry} 必须保持纯 ASCII，避免 Windows PowerShell 5.1 按本地代码页误读`,
    );
  }
});
