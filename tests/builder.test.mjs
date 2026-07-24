import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createPackage, extractAll } from "@electron/asar";
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
