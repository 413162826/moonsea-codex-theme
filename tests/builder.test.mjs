import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createPackage,
  createPackageWithOptions,
  extractAll,
  listPackage,
  statFile,
} from "@electron/asar";
import { WALLPAPERS } from "../src/wallpaper-catalog.mjs";

const projectRoot = path.resolve(path.dirname(process.argv[1]), "..");
const builder = path.join(projectRoot, "tools", "moonsea-builder.mjs");
const themeCss = path.join(projectRoot, "theme", "static", "theme.css");

function writeRpcFixture(unpacked, layout = "split") {
  const assets = path.join(unpacked, "webview", "assets");
  fs.mkdirSync(assets, { recursive: true });
  const fixture = layout === "merged"
    ? {
        file: "app-initial-fixture.js",
        source:
          "var ActionRunner,latestActions,boot=(()=>{ActionRunner=class{scope=null;bindScope(e){this.scope=e}async run(e){return e}},latestActions=new ActionRunner}),host={appActions:latestActions};boot();export{host as appHost};",
      }
    : {
        file: "rpc-fixture.js",
        source:
          "var Runner,legacyActions,boot=(()=>{Runner=class{scope=null;bindScope(e){this.scope=e}async run(e){return e}},legacyActions=new Runner}),host={appActions:legacyActions};boot();export{host as appHost};",
      };
  fs.writeFileSync(
    path.join(assets, fixture.file),
    fixture.source,
  );
  return fixture.file;
}

async function createFixture(root, platform, rpcLayout = "split") {
  const source =
    platform === "mac"
      ? path.join(root, "Official.app")
      : path.join(root, "Official-Windows");
  const asarPath =
    platform === "mac"
      ? path.join(source, "Contents", "Resources", "app.asar")
      : path.join(source, "resources", "app.asar");
  const unpacked = path.join(root, `${platform}-unpacked`);
  fs.mkdirSync(path.join(unpacked, "webview"), { recursive: true });
  fs.writeFileSync(
    path.join(unpacked, "webview", "index.html"),
    "<!doctype html><html><head></head><body><div id=\"root\"></div></body></html>",
  );
  const rpcFile = writeRpcFixture(unpacked, rpcLayout);
  fs.writeFileSync(
    path.join(unpacked, "webview", "avatar-overlay-composition-surface.html"),
    "<!doctype html><html><head></head><body><div id=\"root\"></div></body></html>",
  );
  fs.mkdirSync(path.dirname(asarPath), { recursive: true });
  await createPackage(unpacked, asarPath);
  if (platform === "mac") {
    fs.mkdirSync(path.join(source, "Contents", "MacOS"), { recursive: true });
    fs.writeFileSync(path.join(source, "Contents", "MacOS", "ChatGPT"), "fixture");
  } else {
    fs.writeFileSync(path.join(source, "ChatGPT.exe"), "fixture");
  }
  return { rpcFile, source };
}

async function createWorkBuddyFixture(root) {
  const source = path.join(root, "Official-WorkBuddy");
  const asarPath = path.join(source, "resources", "app.asar");
  const unpacked = path.join(root, "workbuddy-unpacked");
  const renderer = path.join(unpacked, "renderer");
  const assets = path.join(renderer, "assets");
  fs.mkdirSync(assets, { recursive: true });
  fs.writeFileSync(
    path.join(unpacked, "package.json"),
    JSON.stringify({
      name: "@genie/workbuddy-desktop",
      version: "5.3.5",
      main: "main/index.js",
    }),
  );
  fs.writeFileSync(
    path.join(renderer, "index.html"),
    "<!doctype html><html><head></head><body><div id=\"root\"></div></body></html>",
  );
  fs.writeFileSync(
    path.join(assets, "contexts-fixture.js"),
    [
      "var THEME_STORAGE_KEY=\"agent-ui-theme\";",
      "var ThemeManager=class{setTheme(theme){return theme}};",
      "function setTheme(theme){return new ThemeManager().setTheme(theme)}",
      "export{ThemeManager as T};",
    ].join(""),
  );
  const ripgrepRoot = path.join(unpacked, "cli", "vendor", "ripgrep");
  const hostPlatform = process.platform === "win32" ? "windows" : process.platform;
  const hostArchitecture = process.arch === "arm64" ? "arm64" : "x64";
  const hostDirectory = `${hostArchitecture}-${hostPlatform}`;
  const hostBinary = hostPlatform === "windows" ? "rg.exe" : "rg";
  const foreignDirectory =
    hostDirectory === "x64-linux" ? "x64-windows" : "x64-linux";
  const foreignBinary = foreignDirectory.endsWith("-windows") ? "rg.exe" : "rg";
  fs.mkdirSync(path.join(ripgrepRoot, hostDirectory), { recursive: true });
  fs.mkdirSync(path.join(ripgrepRoot, foreignDirectory), { recursive: true });
  fs.writeFileSync(
    path.join(ripgrepRoot, hostDirectory, hostBinary),
    "current-platform",
  );
  fs.writeFileSync(
    path.join(ripgrepRoot, foreignDirectory, foreignBinary),
    "foreign-platform",
  );
  fs.mkdirSync(path.dirname(asarPath), { recursive: true });
  await createPackageWithOptions(unpacked, asarPath, {
    unpackDir: path.join("cli", "vendor", "ripgrep"),
  });
  fs.rmSync(
    path.join(
      `${asarPath}.unpacked`,
      "cli",
      "vendor",
      "ripgrep",
      foreignDirectory,
      foreignBinary,
    ),
  );
  fs.writeFileSync(path.join(source, "WorkBuddy.exe"), "fixture");
  return {
    source,
    hostDirectory,
    hostBinary,
    foreignDirectory,
    foreignBinary,
  };
}

async function verifyLayout(platform, edition = "standard", rpcLayout = "split") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `moonsea-${platform}-test-`));
  try {
    const { rpcFile, source } = await createFixture(root, platform, rpcLayout);
    const target = path.join(
      root,
      platform === "mac"
        ? "Moonsea-Codex-test.app"
        : "Moonsea-Codex-test-windows",
    );
    const editionArgs = ["--edition", edition];
    execFileSync(process.execPath, [builder, ...editionArgs, source, target], { stdio: "pipe" });
    execFileSync(process.execPath, [builder, ...editionArgs, "--verify", target], {
      stdio: "pipe",
    });

    const asarPath =
      platform === "mac"
        ? path.join(target, "Contents", "Resources", "app.asar")
        : path.join(target, "resources", "app.asar");
    const extracted = path.join(root, `${platform}-result`);
    extractAll(asarPath, extracted);
    const index = fs.readFileSync(
      path.join(extracted, "webview", "index.html"),
      "utf8",
    );
    const composition = fs.readFileSync(
      path.join(
        extracted,
        "webview",
        "avatar-overlay-composition-surface.html",
      ),
      "utf8",
    );
    const bridge = fs.readFileSync(
      path.join(extracted, "webview", "moonsea", "appearance-bridge.js"),
      "utf8",
    );
    const rpcSource = fs.readFileSync(
      path.join(extracted, "webview", "assets", rpcFile),
      "utf8",
    );
    assert.match(index, /codex-moonsea-appearance-bridge/);
    assert.match(bridge, new RegExp(`\\.\\./assets/${rpcFile.replace(".", "\\.")}`));
    assert.match(bridge, /module\[APP_ACTIONS_EXPORT\]/);
    assert.doesNotMatch(bridge, /services\?\.appActions/);
    assert.match(rpcSource, /\bas moonseaAppActions\b/);
    for (const wallpaper of WALLPAPERS) {
      assert.equal(
        fs.existsSync(path.join(extracted, "webview", "moonsea", "wallpapers", wallpaper.file)),
        true,
        `${wallpaper.name} 应进入 Codex 安装包`,
      );
    }
    if (edition === "standard") {
      assert.doesNotMatch(index, /codex-moonsea-static-theme/);
      assert.doesNotMatch(index, /codex-moonsea-pet-overlay/);
      assert.doesNotMatch(composition, /codex-moonsea-pet-overlay/);
    } else {
      assert.match(index, /codex-moonsea-static-theme/);
      assert.match(index, /codex-moonsea-pet-overlay/);
      assert.match(composition, /codex-moonsea-pet-overlay/);
      assert.doesNotMatch(composition, /codex-moonsea-static-theme/);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("构建兼容旧版独立 RPC 模块", () => verifyLayout("windows", "standard", "split"));
test("构建兼容新版合并 RPC 模块", () => verifyLayout("windows", "standard", "merged"));
test("构建 macOS 应用包布局", () => verifyLayout("mac"));
test("Pro 构建保留运行时视觉能力", () => verifyLayout("windows", "pro"));

test("WorkBuddy 构建写入 renderer 并连接其原生主题管理器", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-workbuddy-test-"));
  try {
    const {
      source,
      hostDirectory,
      hostBinary,
      foreignDirectory,
      foreignBinary,
    } = await createWorkBuddyFixture(root);
    const corruptSource = path.join(root, "Official-WorkBuddy-Corrupt");
    fs.cpSync(source, corruptSource, { recursive: true });
    fs.rmSync(
      path.join(
        corruptSource,
        "resources",
        "app.asar.unpacked",
        "cli",
        "vendor",
        "ripgrep",
        hostDirectory,
        hostBinary,
      ),
    );
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [
            builder,
            "--client",
            "workbuddy",
            "--edition",
            "standard",
            corruptSource,
            path.join(root, "Moonsea-WorkBuddy-corrupt-windows"),
          ],
          { stdio: "pipe" },
        ),
      /月海 WorkBuddy 包不完整/,
      "首次构建也必须拒绝当前平台 unpacked 文件缺失",
    );

    const target = path.join(root, "Moonsea-WorkBuddy-test-windows");
    execFileSync(
      process.execPath,
      [builder, "--client", "workbuddy", "--edition", "standard", source, target],
      { stdio: "pipe" },
    );
    execFileSync(
      process.execPath,
      [builder, "--client", "workbuddy", "--edition", "standard", "--verify", target],
      { stdio: "pipe" },
    );

    const extracted = path.join(root, "workbuddy-result");
    extractAll(path.join(target, "resources", "app.asar"), extracted);
    const index = fs.readFileSync(
      path.join(extracted, "renderer", "index.html"),
      "utf8",
    );
    const bridge = fs.readFileSync(
      path.join(extracted, "renderer", "moonsea", "appearance-bridge.js"),
      "utf8",
    );
    const themeModule = fs.readFileSync(
      path.join(extracted, "renderer", "assets", "contexts-fixture.js"),
      "utf8",
    );
    const metadata = JSON.parse(
      fs.readFileSync(
        path.join(extracted, "renderer", "moonsea", "metadata.json"),
        "utf8",
      ),
    );

    assert.match(index, /codex-moonsea-appearance-bridge/);
    assert.match(bridge, /\.\.\/assets\/contexts-fixture\.js/);
    assert.match(bridge, /moonseaSetTheme\(theme\.mode\)/);
    assert.doesNotMatch(bridge, /app\.appearance\.set_mode/);
    assert.match(themeModule, /\bas moonseaSetTheme\b/);
    assert.equal(metadata.client, "workbuddy");
    const entries = listPackage(path.join(target, "resources", "app.asar"), {
      isPack: false,
    });
    assert.equal(
      entries.some(
        (entry) =>
          entry.replaceAll("\\", "/").endsWith(
            `${foreignDirectory}/${foreignBinary}`,
          ),
      ),
      false,
      "官方当前平台未发布的 unpacked 条目不应污染新包",
    );
    assert.equal(
      statFile(
        path.join(target, "resources", "app.asar"),
        path.join("cli", "vendor", "ripgrep", hostDirectory, hostBinary),
      ).unpacked,
      true,
    );
    assert.equal(
      fs.readFileSync(
        path.join(
          target,
          "resources",
          "app.asar.unpacked",
          "cli",
          "vendor",
          "ripgrep",
          hostDirectory,
          hostBinary,
        ),
        "utf8",
      ),
      "current-platform",
    );

    execFileSync(
      process.execPath,
      [
        builder,
        "--client",
        "workbuddy",
        "--edition",
        "standard",
        "--patch",
        target,
      ],
      { stdio: "pipe" },
    );
    const archivePath = path.join(target, "resources", "app.asar");
    const archiveBeforeCorruption = fs.readFileSync(archivePath);
    fs.rmSync(
      path.join(
        `${archivePath}.unpacked`,
        "cli",
        "vendor",
        "ripgrep",
        hostDirectory,
        hostBinary,
      ),
    );
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [
            builder,
            "--client",
            "workbuddy",
            "--edition",
            "standard",
            "--patch",
            target,
          ],
          { stdio: "pipe" },
        ),
      /月海 WorkBuddy 包不完整/,
    );
    assert.equal(
      fs.readFileSync(archivePath).equals(archiveBeforeCorruption),
      true,
      "损坏包检测失败时不得改写现有 ASAR",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("设置页卡片使用月海深色表面令牌", () => {
  const css = fs.readFileSync(themeCss, "utf8");
  assert.match(
    css,
    /--color-background-panel:\s*var\(--moonsea-panel-strong\)\s*!important;/,
  );
  assert.match(
    css,
    /--color-token-bg-fog:\s*var\(--moonsea-panel-strong\)\s*!important;/,
  );
});

test("WorkBuddy 主区与侧栏表面允许壁纸透出", () => {
  const css = fs.readFileSync(themeCss, "utf8");
  assert.match(
    css,
    /html\.codex-moonsea:is\(\.cb-dark, \.cb-light\)[\s\S]*?\.teams-container \[class\*="_gridViewItem_"\][^{]*\{[^}]*background:\s*transparent\s*!important;/s,
  );
  assert.match(
    css,
    /html\.codex-moonsea:is\(\.cb-dark, \.cb-light\) \.main-content[^{]*\{[^}]*background:\s*var\(--moonsea-panel\)\s*!important;/s,
  );
  assert.match(
    css,
    /html\.codex-moonsea:is\(\.cb-dark, \.cb-light\) \.conversation-list[^{]*\{[^}]*background:\s*var\(--moonsea-sidebar\)\s*!important;/s,
  );
});

test("顶部栏直接复用主界面表面令牌", () => {
  const css = fs.readFileSync(themeCss, "utf8");
  const runtime = fs.readFileSync(
    path.join(projectRoot, "theme", "static", "theme.js"),
    "utf8",
  );

  assert.match(css, /--moonsea-titlebar:\s*var\(--moonsea-panel\);/);
  assert.match(css, /--codex-titlebar-tint:\s*var\(--moonsea-titlebar\)\s*!important;/);
  assert.match(css, /--vscode-titleBar-activeBackground:\s*var\(--moonsea-titlebar\)\s*!important;/);
  assert.doesNotMatch(css, /--moonsea-titlebar-alpha/);
  assert.doesNotMatch(runtime, /--moonsea-titlebar-alpha/);
});

test("内置壁纸地址跟随当前客户端文档协议", () => {
  const runtime = fs.readFileSync(
    path.join(projectRoot, "theme", "static", "theme.js"),
    "utf8",
  );
  assert.match(
    runtime,
    /new URL\(`\.\/moonsea\/wallpapers\/\$\{runtime\.wallpaper\}`, document\.baseURI\)\.href/,
  );
  assert.doesNotMatch(runtime, /app:\/\/-\/moonsea\/wallpapers/);
});
