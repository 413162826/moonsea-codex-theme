import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import {
  createRequestHandler,
  isAllowedOrigin,
  isLocalAdminOrigin,
  parseDevToolsActivePort,
  PUBLIC_SITE_ORIGIN,
} from "../src/manager-core.mjs";
import { getStandardTheme, STANDARD_THEMES } from "../src/theme-catalog.mjs";
import { getProTheme, PRO_THEMES } from "../src/pro-theme-catalog.mjs";
import { WALLPAPER_DRAFTS, WALLPAPERS } from "../src/wallpaper-catalog.mjs";

const projectRoot = path.resolve(path.dirname(process.argv[1]), "..");

function requestLocalPage(handler, url, origin = "") {
  return new Promise((resolve, reject) => {
    let statusCode = 0;
    let headers = {};
    const request = {
      method: "GET",
      url,
      headers: {
        host: "127.0.0.1:17321",
        ...(origin ? { origin } : {}),
      },
    };
    const response = {
      writeHead(code, nextHeaders = {}) {
        statusCode = code;
        headers = nextHeaders;
      },
      end(body = "") {
        resolve({
          statusCode,
          headers,
          body: Buffer.isBuffer(body) ? body.toString("utf8") : String(body),
        });
      },
    };
    Promise.resolve(handler(request, response)).catch(reject);
  });
}

test("普通主题全部组装为免费渐变壁纸运行时", () => {
  assert.ok(STANDARD_THEMES.length >= 4);
  for (const theme of STANDARD_THEMES) {
    assert.equal(theme.edition, "standard");
    assert.equal(Object.hasOwn(theme, "patch"), false);
    assert.equal(theme.runtime.tier, "standard");
    assert.equal(theme.runtime.backgroundGradient, theme.previewGradient);
    assert.equal(theme.runtime.palette.scheme, theme.mode);
  }
  assert.equal(getStandardTheme("deep-sea").mode, "dark");
});

test("拒绝不存在的普通主题", () => {
  assert.throws(() => getStandardTheme("unknown"), /没有这个普通主题/);
});

test("Pro 主题使用同一壁纸运行时并保留精选图片资产", () => {
  assert.equal(PRO_THEMES.length, 1);
  assert.deepEqual(PRO_THEMES.map(({ id }) => id), ["tide-dragon-realm"]);
  for (const theme of PRO_THEMES) {
    const wallpaper = WALLPAPERS.find(({ id }) => id === theme.id);
    assert.equal(theme.edition, "pro");
    assert.equal(theme.mode, wallpaper.palette.scheme);
    assert.equal(Object.hasOwn(theme, "patch"), false);
    assert.equal(theme.runtime.tier, "pro");
    assert.equal(Object.hasOwn(theme.runtime, "motion"), false);
    assert.match(theme.previewImage, /^\.\/wallpapers\/[a-z0-9-]+\.webp$/);
    assert.match(theme.previewGradient, /gradient\(/);
    assert.match(theme.runtime.wallpaperGradient, /gradient\(/);
    assert.deepEqual(theme.runtime.palette, wallpaper.palette);
    assert.ok(["light", "dark"].includes(theme.runtime.palette.scheme));
  }
  assert.equal(getProTheme("tide-dragon-realm").runtime.layout, "immersive");
  assert.deepEqual(
    WALLPAPER_DRAFTS.map(({ id }) => id),
    ["mint-academy", "vinyl-citrus"],
  );
  assert.throws(() => getProTheme("mint-academy"), /没有这个 Pro 主题/);
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
  assert.equal(isLocalAdminOrigin("http://127.0.0.1:17321"), true);
  assert.equal(isLocalAdminOrigin("http://localhost:17321"), true);
  assert.equal(isLocalAdminOrigin(PUBLIC_SITE_ORIGIN), false);
});

test("管理员入口仅在本机授权标记存在时向官网公开", async () => {
  const hiddenHandler = createRequestHandler({
    profilePath: "fixture",
    siteRoot: path.join(projectRoot, "site"),
    status: async () => ({ connected: false, message: "fixture" }),
  });
  const hidden = await requestLocalPage(hiddenHandler, "/api/status", PUBLIC_SITE_ORIGIN);
  assert.equal(hidden.statusCode, 200);
  assert.equal(JSON.parse(hidden.body).adminAccess, false);

  const ownerHandler = createRequestHandler({
    profilePath: "fixture",
    siteRoot: path.join(projectRoot, "site"),
    adminAccess: true,
    status: async () => ({ connected: false, message: "fixture" }),
  });
  const owner = await requestLocalPage(ownerHandler, "/api/status", PUBLIC_SITE_ORIGIN);
  assert.equal(owner.statusCode, 200);
  assert.equal(JSON.parse(owner.body).adminAccess, true);
});

test("主题创作台只由本机助手提供且实验壁纸不进入公开目录", async () => {
  const handler = createRequestHandler({
    profilePath: "fixture",
    siteRoot: path.join(projectRoot, "site"),
    adminRoot: path.join(projectRoot, "admin"),
    draftRoot: path.join(projectRoot, "assets", "admin-drafts"),
    status: async () => ({ connected: false, message: "fixture" }),
  });

  const redirect = await requestLocalPage(handler, "/admin");
  assert.equal(redirect.statusCode, 308);
  assert.equal(redirect.headers.Location, "/admin/");

  const page = await requestLocalPage(handler, "/admin/");
  assert.equal(page.statusCode, 200);
  assert.match(page.body, /主题创作台/);
  assert.match(page.body, /实际界面与封面同源预览/);

  const drafts = await requestLocalPage(handler, "/api/admin/drafts");
  assert.equal(drafts.statusCode, 200);
  assert.deepEqual(
    JSON.parse(drafts.body).drafts.map(({ id }) => id),
    ["mint-academy", "vinyl-citrus"],
  );

  const publicRequest = await requestLocalPage(handler, "/admin/", PUBLIC_SITE_ORIGIN);
  assert.equal(publicRequest.statusCode, 403);
  assert.match(publicRequest.body, /只允许本机访问/);

  assert.equal(fs.existsSync(path.join(projectRoot, "site", "admin", "index.html")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, "assets", "admin-drafts", "mint-academy.png")), true);
  assert.equal(PRO_THEMES.some(({ id }) => id === "mint-academy"), false);
  assert.equal(PRO_THEMES.some(({ id }) => id === "vinyl-citrus"), false);
});

test("普通主题网页不提供透明度控件", () => {
  const html = fs.readFileSync(path.join(projectRoot, "site", "index.html"), "utf8");
  assert.doesNotMatch(html, /type=["']range["']/);
  assert.doesNotMatch(html, /id=["'][^"']*opacity/);
});

test("普通壁纸封面使用受约束的完整 Codex 窗口缩略图", () => {
  const website = fs.readFileSync(path.join(projectRoot, "site", "app.js"), "utf8");
  const styles = fs.readFileSync(path.join(projectRoot, "site", "styles.css"), "utf8");

  assert.match(website, /createStandardPreview/);
  assert.match(website, /preview-window__titlebar/);
  assert.match(website, /preview-window__workspace/);
  assert.match(website, /Build a product people remember/);
  assert.match(styles, /\.preview-window\s*\{/);
  assert.match(styles, /\.preview-window__code\s*\{/);
  assert.doesNotMatch(styles, /repeating-linear-gradient/);
  assert.doesNotMatch(website, /preview-content/);
});

test("控制桥等待 Codex 官方动作作用域就绪", () => {
  const bridge = fs.readFileSync(
    path.join(projectRoot, "theme", "runtime", "appearance-bridge.template.js"),
    "utf8",
  );
  assert.match(bridge, /appActions\.scope != null/);
  assert.match(bridge, /getStatus/);
  assert.match(bridge, /applyRuntimeTheme/);
  assert.match(bridge, /app\.appearance\.set_mode/);
  assert.doesNotMatch(bridge, /app\.appearance\.set_theme/);
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

test("统一壁纸运行时可以启用并完整退出", () => {
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
  assert.match(runtime, /applyRuntimePalette/);
  assert.match(runtime, /PALETTE_PROPERTIES/);
  assert.match(runtime, /root\.style\.colorScheme = runtime\.palette\.scheme/);
  assert.match(runtime, /applyRuntimePalette\(null\)/);
  assert.match(runtime, /--moonsea-wallpaper-gradient/);
  assert.match(runtime, /url\("app:\/\/-\/moonsea\/wallpapers\/\$\{runtime\.wallpaper\}"\)/);
  assert.doesNotMatch(runtime, /\.\/moonsea\/wallpapers\//);
  assert.match(runtime, /savedWallpaperRecord/);
  assert.match(runtime, /settings\.wallpaperSource === "custom"/);
  assert.match(runtime, /applyPackagedWallpaper\(runtime\)/);
  assert.match(runtime, /runtime\.backgroundGradient/);
});

test("普通与 Pro 壁纸共用完整月海助手和交互特效", () => {
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
  assert.match(runtime, /data-wallpaper-settings hidden/);
  assert.match(runtime, /应用任意渐变或 Pro 壁纸/);
  assert.match(runtime, /activeRuntime\?\.tier === "pro"/);
  assert.match(runtime, /moonseaAssistantUpdateBridge/);
  assert.match(runtime, /addEventListener\("dblclick"/);
  assert.match(runtime, /pendingUpdateCommand = "check"/);
  assert.match(runtime, /pendingUpdateCommand = "download"/);
  assert.match(runtime, /重新打开并更新/);
  assert.match(runtime, /正在启动更新程序/);
  assert.match(runtime, /网络有波动，正在自动续传/);
  assert.match(runtime, /formatUpdateBytes/);
  assert.match(runtime, /aria-valuenow/);
  assert.match(manager, /exchange\?\.command === "check"/);
  assert.match(manager, /getStatus\(\{ force: true \}\)/);
  assert.match(manager, /updater-\$\{targetVersion\}\.ready/);
  assert.match(manager, /updater-launch\.log/);
  assert.match(manager, /startDownload\(\{ autoInstall: true \}\)/);
  assert.match(managerCore, /const command = bridge\.takeCommand\(\);[\s\S]*if \(!command\) bridge\.setStatus/);
  assert.match(runtime, /data-setting="motionMode"/);
  assert.match(runtime, /data-setting="clickRipple"/);
  assert.match(runtime, /data-setting="motionOverrideReduced"/);
  assert.match(runtime, /data-setting="telemetryConsent"/);
  assert.match(runtime, /默认关闭。开启后仅上报随机安装标识/);
  assert.match(runtime, /getTelemetryConsent: \(\) => settings\.telemetryConsent === true/);
  assert.match(manager, /telemetryService\.sync\(exchange\?\.telemetryConsent === true\)/);
  assert.match(managerCore, /telemetryConsent: bridge\.getTelemetryConsent\?\.\(\) === true/);
  assert.match(managerCore, /https:\/\/moonsea-codex-theme\.suguowen5\.chatgpt\.site/);
  assert.match(assistantCss, /\.moonsea-telemetry-settings/);
  assert.match(runtime, /moonsea-motion-override-reduced/);
  assert.match(runtime, /Windows 已关闭动画/);
  assert.match(runtime, /moonsea-controls__dock/);
  assert.match(runtime, /createAmbientMotion/);
  assert.match(runtime, /codex-moonsea-motion-layer/);
  assert.match(runtime, /requestAnimationFrame/);
  assert.match(runtime, /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/);
  assert.match(runtime, /prefers-reduced-motion: reduce/);
  assert.match(runtime, /MOTION_BLOCK_SELECTOR/);
  assert.match(runtime, /runtimeGeneration \+= 1/);
  assert.match(runtime, /generation !== runtimeGeneration/);
  assert.match(runtime, /motionController\?\.destroy\(\)/);
  assert.match(runtime, /events\.abort\(\)/);
  assert.match(assistantCss, /#codex-moonsea-controls\s*\{[\s\S]*display:\s*contents/);
  assert.match(assistantCss, /\.moonsea-controls__dock/);
  assert.match(assistantCss, /\.moonsea-motion-settings/);
  assert.match(assistantCss, /\.moonsea-reduced-motion-row\[hidden\]/);
  assert.match(assistantCss, /\.moonsea-select-row select:focus-visible/);
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
  assert.equal(catalog.catalogVersion, 3);
  assert.equal(catalog.themes.filter(({ edition }) => edition === "pro").length, WALLPAPERS.length);
});

test("官网按系统直下安装包且入口使用通用命名", () => {
  const website = fs.readFileSync(path.join(projectRoot, "site", "app.js"), "utf8");
  const page = fs.readFileSync(path.join(projectRoot, "site", "index.html"), "utf8");
  assert.match(website, /Moonsea-Codex-Windows-x64\.zip/);
  assert.match(website, /Moonsea-Codex-macOS\.zip/);
  assert.doesNotMatch(website, /releases\/latest["']/);
  assert.match(website, /status\.runtimeCapable === true/);
  assert.match(website, /status\.catalogVersion >= 3/);
  assert.match(website, /\.\/catalog\.json/);
  assert.match(website, /theme\.previewImage/);
  assert.match(website, /渐变与 Pro 壁纸需要新版月海版/);
  assert.match(website, /\? "需要升级"/);
  assert.match(website, /最后一次手动安装/);
  assert.match(website, /dataset\.themeApply/);
  assert.match(website, /applyTheme\(theme\)/);
  assert.match(website, /应用渐变/);
  assert.match(website, /应用 Pro/);
  assert.match(website, /当前壁纸/);
  assert.match(website, /壁纸已应用/);
  assert.match(website, /await ensureCatalog\(\)/);
  assert.match(website, /dataset\.themeFilter/);
  assert.match(website, /configureAdminLink/);
  assert.match(website, /window\.location\.hostname/);
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
  const installCommand = fs.readFileSync(path.join(projectRoot, "Install.cmd"));
  assert.equal(
    installCommand.every((byte) => byte < 0x80),
    true,
    "Install.cmd 必须保持纯 ASCII，所有中文由已明确设置 UTF-8 的 PowerShell 入口输出",
  );
  assert.match(installCommand.toString("ascii"), /Invoke-Moonsea-Install\.ps1/);
  for (const entry of fs.readdirSync(scriptsRoot).filter((name) => name.endsWith(".ps1"))) {
    const script = fs.readFileSync(path.join(scriptsRoot, entry));
    assert.equal(
      script.every((byte) => byte < 0x80),
      true,
      `${entry} 必须保持纯 ASCII，避免 Windows PowerShell 5.1 按本地代码页误读`,
    );
  }
  const installEntry = fs.readFileSync(
    path.join(scriptsRoot, "Invoke-Moonsea-Install.ps1"),
    "ascii",
  );
  assert.match(installEntry, /\[Console\]::OutputEncoding = \$utf8NoBom/);
  assert.match(installEntry, /Start-Transcript/);
  assert.match(installEntry, /install-result\.json/);
  assert.match(installEntry, /technicalError/);
});
