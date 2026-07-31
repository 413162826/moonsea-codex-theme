import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import {
  createRequestHandler,
  getClientTargetConfig,
  isAllowedOrigin,
  isLocalAdminOrigin,
  parseDevToolsActivePort,
  PUBLIC_SITE_ORIGIN,
  THEME_BRIDGE,
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
  assert.equal(PRO_THEMES.length, 2);
  assert.deepEqual(PRO_THEMES.map(({ id }) => id), [
    "tide-dragon-realm",
    "moonlit-silent",
  ]);
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
  assert.equal(getProTheme("moonlit-silent").runtime.wallpaper, "moonlit-silent.png");
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

test("WorkBuddy 助手只连接 renderer 主页面和固定主题桥", () => {
  const target = getClientTargetConfig("workbuddy");
  assert.equal(target.url, null);
  assert.match(
    "file:///D:/Moonsea/WorkBuddy/resources/app.asar/renderer/index.html",
    target.pattern,
  );
  assert.doesNotMatch("app://-/webview/index.html", target.pattern);
  assert.equal(THEME_BRIDGE, "window.moonseaThemeBridge");
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

  let dynamicAccess = false;
  const dynamicHandler = createRequestHandler({
    profilePath: "fixture",
    siteRoot: path.join(projectRoot, "site"),
    adminAccess: () => dynamicAccess,
    status: async () => ({ connected: false, message: "fixture" }),
  });
  const beforeMarker = await requestLocalPage(dynamicHandler, "/api/status", PUBLIC_SITE_ORIGIN);
  assert.equal(JSON.parse(beforeMarker.body).adminAccess, false);
  dynamicAccess = true;
  const afterMarker = await requestLocalPage(dynamicHandler, "/api/status", PUBLIC_SITE_ORIGIN);
  assert.equal(JSON.parse(afterMarker.body).adminAccess, true);
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

test("控制桥通过构建期识别的本地动作执行器调用官方动作", () => {
  const bridge = fs.readFileSync(
    path.join(projectRoot, "theme", "runtime", "appearance-bridge.template.js"),
    "utf8",
  );
  assert.match(bridge, /module\[APP_ACTIONS_EXPORT\]/);
  assert.doesNotMatch(bridge, /services\?\.appActions/);
  assert.match(bridge, /ready:\s*true/);
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
  const bridge = fs.readFileSync(
    path.join(projectRoot, "theme", "runtime", "appearance-bridge.template.js"),
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
  assert.match(
    runtime,
    /new URL\(`\.\/moonsea\/wallpapers\/\$\{runtime\.wallpaper\}`, document\.baseURI\)\.href/,
  );
  assert.doesNotMatch(runtime, /app:\/\/-\/moonsea\/wallpapers/);
  assert.match(runtime, /savedWallpaperRecord/);
  assert.match(runtime, /settings\.wallpaperSource === "custom"/);
  assert.match(runtime, /applyPackagedWallpaper\(runtime\)/);
  assert.match(runtime, /runtime\.backgroundGradient/);
  assert.match(runtime, /runtime\.wallpaperAssetId/);
  assert.match(runtime, /runtime\.wallpaperDataUrl/);
  assert.match(runtime, /writeSavedWallpaper\(record,\s*themeWallpaperKey/);
  assert.match(runtime, /readSavedWallpaper\(themeWallpaperKey/);
  assert.doesNotMatch(bridge, /runtime:\s*theme\.runtime,/);
  assert.match(bridge, /delete runtime\.wallpaperDataUrl/);
});

test("普通与 Pro 壁纸共用精简后的完整月海助手", () => {
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
  assert.doesNotMatch(runtime, /effectsEnabled/);
  assert.doesNotMatch(runtime, /LEGACY_MOTION_MODES/);
  assert.doesNotMatch(runtime, /saved\.motionMode|saved\.clickRipple/);
  assert.doesNotMatch(runtime, /data-setting="motionMode"/);
  assert.doesNotMatch(runtime, /data-setting="clickRipple"/);
  assert.doesNotMatch(runtime, /data-setting="motionOverrideReduced"/);
  assert.doesNotMatch(runtime, /data-setting="telemetryConsent"/);
  assert.doesNotMatch(runtime, /匿名使用统计|帮助改进月海|getTelemetryConsent/);
  assert.match(manager, /setInterval\(\(\) => \{[\s\S]*telemetryService\.sync\(\)[\s\S]*TELEMETRY_INTERVAL_MS/);
  assert.match(manager, /void telemetryService\.sync\(\)\.catch/);
  assert.match(manager, /readArgument\("--app-pid"\)/);
  assert.match(manager, /process\.kill\(appPid, 0\)/);
  assert.match(manager, /clearInterval\(appLifecycleTimer\)/);
  assert.doesNotMatch(managerCore, /telemetryConsent|getTelemetryConsent/);
  assert.match(managerCore, /https:\/\/moonsea-codex-theme\.suguowen5\.chatgpt\.site/);
  assert.doesNotMatch(assistantCss, /\.moonsea-telemetry-settings/);
  assert.doesNotMatch(runtime, /moonsea-motion|交互特效|点击月晕|跟随系统关闭/);
  assert.match(runtime, /moonsea-controls__dock/);
  assert.match(runtime, /runtimeGeneration \+= 1/);
  assert.match(runtime, /generation !== runtimeGeneration/);
  assert.match(assistantCss, /#codex-moonsea-controls\s*\{[\s\S]*display:\s*contents/);
  assert.match(assistantCss, /\.moonsea-controls__dock/);
  assert.doesNotMatch(assistantCss, /\.moonsea-motion-settings|\.moonsea-reduced-motion-row/);
  assert.match(assistantCss, /\.moonsea-toggle-row input:focus-visible \+ \.moonsea-toggle-switch/);
  assert.match(assistantCss, /\.moonsea-controls__toggle\.is-update-available::after/);
  assert.match(assistantCss, /prefers-reduced-motion/);
});

test("月海助手与 Codex 进程生命周期绑定", () => {
  const windowsLauncher = fs.readFileSync(
    path.join(projectRoot, "scripts", "windows", "Start-Moonsea-Windows.ps1"),
    "ascii",
  );
  const macosLauncher = fs.readFileSync(
    path.join(projectRoot, "scripts", "macos", "Start-Moonsea-macOS.command"),
    "utf8",
  );
  assert.match(windowsLauncher, /Start-Process -FilePath \$app[\s\S]*Wait-ForActiveMainProcess/);
  assert.doesNotMatch(windowsLauncher, /\$appProcess\s*=\s*Start-Process[\s\S]*\$appProcess\.Id/);
  assert.match(windowsLauncher, /--app-pid \$appProcessId/);
  assert.match(macosLauncher, /APP_PID=/);
  assert.match(macosLauncher, /MOONSEA_APP_PID/);
  assert.match(macosLauncher, /--app-pid "\$APP_PID"/);
});

test("Codex 进程退出后助手自行停止", async () => {
  const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-manager-lifecycle-"));
  const profilePath = path.join(installRoot, "BrowserProfile");
  fs.mkdirSync(profilePath, { recursive: true });
  fs.writeFileSync(path.join(installRoot, "telemetry.json"), `${JSON.stringify({
    installId: "65f5e77a-9504-4f6c-8a78-f3a8561c5c1f",
    lastReportedAt: Date.now(),
  })}\n`, "utf8");

  const app = spawn(process.execPath, ["-e", "setTimeout(() => {}, 350)"], {
    stdio: "ignore",
  });
  const manager = spawn(process.execPath, [
    path.join(projectRoot, "src", "manager.mjs"),
    "--install-root", installRoot,
    "--profile-path", profilePath,
    "--app-pid", String(app.pid),
  ], {
    env: {
      ...process.env,
      MOONSEA_MANAGER_PORT: "28321",
      MOONSEA_PROJECT_ROOT: projectRoot,
    },
    stdio: "ignore",
  });

  try {
    const exitCode = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Codex 退出后助手没有在时限内停止"));
      }, 5_000);
      manager.once("exit", (code) => {
        clearTimeout(timeout);
        resolve(code);
      });
      manager.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    assert.equal(exitCode, 0);
    assert.equal(fs.existsSync(path.join(installRoot, "manager.pid")), false);
  } finally {
    if (app.exitCode === null) app.kill();
    if (manager.exitCode === null) manager.kill();
    fs.rmSync(installRoot, { recursive: true, force: true });
  }
});

test("壁纸目录同时生成官网预览与安装资源", () => {
  assert.ok(WALLPAPERS.length >= 1);
  for (const wallpaper of WALLPAPERS) {
    const source = path.join(projectRoot, "assets", "wallpapers", wallpaper.file);
    const installerPreview = path.join(projectRoot, "site", "wallpapers", wallpaper.previewFile);
    const productionPreview = path.join(
      projectRoot,
      "web",
      "public",
      "wallpapers",
      wallpaper.previewFile,
    );
    assert.equal(
      fs.existsSync(source),
      true,
      `${wallpaper.name} 原图应存在`,
    );
    assert.equal(
      fs.existsSync(installerPreview),
      true,
      `${wallpaper.name} 安装包预览应存在`,
    );
    assert.equal(fs.existsSync(productionPreview), true, `${wallpaper.name} 生产站预览应存在`);
    assert.deepEqual(fs.readFileSync(productionPreview), fs.readFileSync(installerPreview));
  }
  const installerCatalog = fs.readFileSync(path.join(projectRoot, "site", "catalog.json"), "utf8");
  const productionCatalog = fs.readFileSync(path.join(projectRoot, "web", "public", "catalog.json"), "utf8");
  assert.equal(productionCatalog, installerCatalog);
  const parsedCatalog = JSON.parse(installerCatalog);
  assert.equal(parsedCatalog.catalogVersion, 3);
  assert.equal(parsedCatalog.themes.filter(({ edition }) => edition === "pro").length, WALLPAPERS.length);

  const installerManifest = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "site", "theme-catalog-v1.json"), "utf8"),
  );
  const productionManifest = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "web", "public", "base-theme-catalog-v1.json"), "utf8"),
  );
  assert.deepEqual(productionManifest, installerManifest);
  assert.equal(
    fs.existsSync(path.join(projectRoot, "web", "public", "theme-catalog-v1.json")),
    false,
    "生产站公开清单必须由动态接口返回",
  );
  assert.equal(productionManifest.schemaVersion, 1);
  assert.equal(productionManifest.themes.length, STANDARD_THEMES.length + PRO_THEMES.length);
  for (const wallpaper of WALLPAPERS) {
    const source = path.join(projectRoot, "assets", "wallpapers", wallpaper.file);
    const productionAsset = path.join(projectRoot, "web", "public", "theme-assets", wallpaper.file);
    const theme = productionManifest.themes.find(({ id }) => id === wallpaper.id);
    assert.deepEqual(fs.readFileSync(productionAsset), fs.readFileSync(source));
    assert.equal(theme.asset.size, fs.statSync(source).size);
    assert.equal(
      theme.asset.sha256,
      crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex"),
    );
    assert.equal(theme.asset.contentType, "image/png");
    assert.equal(
      theme.asset.url,
      `https://moonsea-codex-theme.suguowen5.chatgpt.site/theme-assets/${wallpaper.file}`,
    );
    assert.equal(Object.hasOwn(theme.runtime, "wallpaper"), false);
  }
});

test("官网按系统直下安装包且入口使用通用命名", () => {
  const website = fs.readFileSync(path.join(projectRoot, "site", "app.js"), "utf8");
  const page = fs.readFileSync(path.join(projectRoot, "site", "index.html"), "utf8");
  assert.match(website, /suguowen5\.chatgpt\.site\/download/);
  assert.match(website, /downloadLabel\.textContent = "下载"/);
  assert.doesNotMatch(website, /Moonsea-Codex-Windows|Moonsea-Codex-macOS/);
  assert.match(page, />下载<\/span>/);
  assert.match(page, /moonsea-codex-theme\/wiki/);
  assert.match(website, /status\.runtimeCapable === true/);
  assert.match(website, /status\.themeDeliveryVersion >= 1/);
  assert.match(website, /\.\/catalog\.json/);
  assert.match(website, /theme\.previewImage/);
  assert.match(website, /自动获取新壁纸/);
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

test("Windows 新版更新由同一 Setup.exe 静默接管", () => {
  const manager = fs.readFileSync(path.join(projectRoot, "src", "manager.mjs"), "utf8");
  const installer = fs.readFileSync(
    path.join(projectRoot, "installer", "windows", "Moonsea.iss"),
    "utf8",
  );
  const launcher = fs.readFileSync(
    path.join(projectRoot, "scripts", "windows", "Start-Moonsea-Windows.ps1"),
    "ascii",
  );
  assert.match(manager, /packageKind === "installer"/);
  assert.match(manager, /launchWindowsInstaller\(packagePath, targetVersion\)/);
  assert.match(manager, /"\/VERYSILENT"/);
  assert.match(manager, /"\/SUPPRESSMSGBOXES"/);
  assert.match(manager, /"\/NORESTART"/);
  assert.match(manager, /"\/CLOSEAPPLICATIONS"/);
  assert.match(manager, /"\/MOONSEAUPDATE"/);
  assert.match(
    manager,
    /`\/DIR=\$\{installRoot\}`/,
    "应用内更新必须把当前安装目录显式交给 Setup.exe",
  );
  assert.doesNotMatch(
    installer,
    /\[Run\][\s\S]*Parameters:\s*"--update-restart"/,
    "Setup.exe 不得在月海安装引擎完成前从 [Run] 提前重启",
  );
  assert.match(
    installer,
    /if IsUpdateMode then[\s\S]*MoonseaLauncher\.exe[\s\S]*--update-restart/,
    "更新完成后必须由安装引擎之后的代码启动新版",
  );
  assert.match(
    installer,
    /ResolveUpdateInstallRoot[\s\S]*ExplicitInstallRoot[\s\S]*\{srcexe\}[\s\S]*install\.json/,
    "新安装包必须能从旧版下载目录反推出原安装根目录",
  );
  assert.match(
    installer,
    /CompareText\([\s\S]*\{app\}[\s\S]*ResolveUpdateInstallRoot[\s\S]*停止更新/,
    "更新写入前必须阻止安装目录漂移",
  );
  assert.match(
    launcher,
    /Wait-ForActiveMainProcess/,
    "启动器必须找到真实 Electron 主进程，不能绑定可能立即退出的中间进程",
  );
});

test("正式发布必须经过候选包准入且复用同一批产物", () => {
  const releaseWorkflow = fs.readFileSync(
    path.join(projectRoot, ".github", "workflows", "release.yml"),
    "utf8",
  );
  const ciWorkflow = fs.readFileSync(
    path.join(projectRoot, ".github", "workflows", "ci.yml"),
    "utf8",
  );
  const windowsReleaseGate = fs.readFileSync(
    path.join(projectRoot, "tests", "windows-release-gate.ps1"),
    "utf8",
  );
  assert.match(releaseWorkflow, /workflow_dispatch:/);
  assert.doesNotMatch(releaseWorkflow, /push:\s*\n\s*tags:/);
  assert.match(releaseWorkflow, /windows_release_gate:/);
  assert.match(releaseWorkflow, /workbuddy_windows_release_gate:/);
  assert.match(releaseWorkflow, /tests\/windows-release-gate\.ps1/);
  assert.match(
    releaseWorkflow,
    /workbuddy_windows_release_gate:[\s\S]*actions\/setup-node@[\w.]+[\s\S]*npm ci[\s\S]*tests\/windows-setup-smoke\.ps1[\s\S]*-Client workbuddy/,
  );
  assert.match(
    releaseWorkflow,
    /needs:\s*\[web_gate, windows_candidate, macos_candidate, windows_release_gate, workbuddy_windows_release_gate\]/,
  );
  assert.match(releaseWorkflow, /environment:\s*production-release/);
  assert.match(
    releaseWorkflow,
    /actions\/download-artifact@[\w.]+[\s\S]*merge-multiple:\s*true/,
  );
  assert.match(releaseWorkflow, /scripts\/ci\/probe-release\.sh/);
  assert.match(releaseWorkflow, /Build-WorkBuddy-Setup\.ps1/);
  assert.match(releaseWorkflow, /Moonsea-WorkBuddy-Windows-x64-Setup\.exe/);
  assert.match(releaseWorkflow, /Moonsea-WorkBuddy-macOS\.zip/);
  assert.match(releaseWorkflow, /update-workbuddy\.json/);
  assert.match(ciWorkflow, /working-directory:\s*web/);
  assert.match(ciWorkflow, /npm run lint[\s\S]*npm test/);
  assert.match(
    windowsReleaseGate,
    /Stop-Process -Id \$appProcessId -Force[\s\S]*Get-Process -Id \$managerPid/,
    "Windows 准入必须用真实生命周期验证 manager 绑定，而不是依赖进程命令行格式",
  );
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
  const installer = fs.readFileSync(
    path.join(scriptsRoot, "Install-Moonsea-Windows.ps1"),
    "ascii",
  );
  assert.match(installer, /@\(& node \$BuilderPath @Arguments 2>&1\)/);
  assert.match(installer, /\$output \| ForEach-Object \{ Write-Host \$_ \}/);
});

test("Windows 自定义安装目录会迁移已有的管理员入口标记", () => {
  const scriptsRoot = path.join(projectRoot, "scripts", "windows");
  const codexInstaller = fs.readFileSync(
    path.join(scriptsRoot, "Install-Moonsea-Windows.ps1"),
    "ascii",
  );
  const workBuddyInstaller = fs.readFileSync(
    path.join(scriptsRoot, "Install-Moonsea-WorkBuddy-Windows.ps1"),
    "ascii",
  );

  assert.match(codexInstaller, /\$legacyAdminMarkerPath[\s\S]*Copy-Item -LiteralPath \$legacyAdminMarkerPath -Destination \$adminMarkerPath/);
  assert.match(workBuddyInstaller, /\$legacyAdminMarkerPaths[\s\S]*"MoonseaCodex"[\s\S]*Copy-Item -LiteralPath \$legacyAdminMarkerPath -Destination \$adminMarkerPath/);
});

test("WorkBuddy Windows 链路使用独立客户端协议与安装器", () => {
  const scriptsRoot = path.join(projectRoot, "scripts", "windows");
  const installer = fs.readFileSync(
    path.join(scriptsRoot, "Install-Moonsea-WorkBuddy-Windows.ps1"),
    "ascii",
  );
  const launcher = fs.readFileSync(
    path.join(scriptsRoot, "Start-Moonsea-WorkBuddy-Windows.ps1"),
    "ascii",
  );
  const setupBuilder = fs.readFileSync(
    path.join(scriptsRoot, "Build-WorkBuddy-Setup.ps1"),
    "ascii",
  );
  const setup = fs.readFileSync(
    path.join(projectRoot, "installer", "windows", "WorkBuddy.iss"),
    "utf8",
  );

  assert.match(installer, /--client", "workbuddy"/);
  assert.match(installer, /CurrentVersion\\Uninstall/);
  const discovery = installer.match(
    /function Find-OfficialWorkBuddyApp \{[\s\S]*?\r?\n\}\r?\n\r?\nfunction Get-AppVersion/,
  )?.[0];
  assert.ok(discovery);
  assert.doesNotMatch(discovery, /Get-CimInstance Win32_Process/);
  assert.match(launcher, /\$env:WORKBUDDY_REMOTE_DEBUGGING_PORT/);
  assert.match(launcher, /\$env:WORKBUDDY_USER_DATA_DIR/);
  assert.match(launcher, /\$env:WORKBUDDY_CONFIG_DIR/);
  assert.doesNotMatch(launcher, /--remote-debugging-port/);
  assert.doesNotMatch(launcher, /--user-data-dir/);
  assert.match(setupBuilder, /launcher-workbuddy\\WorkBuddyLauncher\.csproj/);
  assert.match(setupBuilder, /--client workbuddy --theme-version/);
  assert.match(setup, /Invoke-Moonsea-WorkBuddy-Install\.ps1/);
  assert.doesNotMatch(setup, /Invoke-Moonsea-Install\.ps1/);
});

test("WorkBuddy macOS 链路使用独立客户端协议与更新器", () => {
  const scriptsRoot = path.join(projectRoot, "scripts", "macos");
  const installer = fs.readFileSync(
    path.join(scriptsRoot, "install-moonsea-workbuddy.sh"),
    "utf8",
  );
  const launcher = fs.readFileSync(
    path.join(scriptsRoot, "Start-Moonsea-WorkBuddy-macOS.command"),
    "utf8",
  );
  const updater = fs.readFileSync(
    path.join(scriptsRoot, "update-moonsea-workbuddy.sh"),
    "utf8",
  );
  assert.match(installer, /--client workbuddy --edition standard --theme-version/);
  assert.match(installer, /client -string "workbuddy"/);
  assert.match(
    launcher,
    /MOONSEA_MANAGER_PORT="\$\{MOONSEA_MANAGER_PORT:-17322\}"/,
  );
  assert.match(launcher, /WORKBUDDY_REMOTE_DEBUGGING_PORT/);
  assert.match(launcher, /WORKBUDDY_USER_DATA_DIR/);
  assert.match(launcher, /WORKBUDDY_CONFIG_DIR/);
  assert.doesNotMatch(launcher, /--remote-debugging-port|--user-data-dir/);
  assert.match(updater, /install-moonsea-workbuddy\.sh/);
  assert.doesNotMatch(updater, /scripts\/macos\/install-moonsea\.sh/);
});

test("Windows 安装失败不会留下可点击快捷方式", () => {
  const setup = fs.readFileSync(
    path.join(projectRoot, "installer", "windows", "Moonsea.iss"),
    "utf8",
  );
  assert.match(setup, /HadWorkingInstallation:\s*Boolean/);
  assert.match(setup, /procedure RemoveFailedInstallShortcuts/);
  assert.match(setup, /if not HadWorkingInstallation then\s+RemoveFailedInstallShortcuts/s);
});
