import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  compareVersions,
  UpdateService,
  validateUpdateManifest,
} from "../src/update-service.mjs";
import { APP_VERSION } from "../src/version.mjs";
import packageMetadata from "../package.json" with { type: "json" };

function manifestFor(buffer, version = "9.0.0") {
  const entry = {
    url: "https://example.com/moonsea.zip",
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    size: buffer.length,
  };
  return {
    schemaVersion: 1,
    version,
    notes: "更新测试",
    publishedAt: "2026-07-22T00:00:00Z",
    platforms: { windows: entry, macos: entry },
  };
}

test("产品版本与安装包版本一致", () => {
  assert.equal(APP_VERSION, packageMetadata.version);
});

test("语义版本比较支持稳定版与预发布版", () => {
  assert.equal(compareVersions("1.4.0", "1.3.9"), 1);
  assert.equal(compareVersions("1.4.0-beta.2", "1.4.0"), -1);
  assert.equal(compareVersions("1.4.0", "1.4.0"), 0);
  assert.throws(() => compareVersions("latest", "1.0.0"), /版本号无效/);
});

test("更新清单必须提供当前平台的 HTTPS 安装包和完整校验信息", () => {
  const buffer = Buffer.from("moonsea-update");
  const selected = validateUpdateManifest(manifestFor(buffer), "win32", APP_VERSION);
  assert.equal(selected.version, "9.0.0");
  assert.equal(selected.package.size, buffer.length);

  const insecure = manifestFor(buffer);
  insecure.platforms.windows.url = "http://example.com/moonsea.zip";
  assert.throws(() => validateUpdateManifest(insecure, "win32", APP_VERSION), /HTTPS/);
});

test("更新服务下载到安装目录、校验后再交给独立更新器", async () => {
  const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-update-service-"));
  const updaterPath = path.join(installRoot, "updater.ps1");
  const archive = Buffer.from("verified-moonsea-package");
  const manifest = manifestFor(archive);
  fs.writeFileSync(updaterPath, "test", "utf8");
  const launches = [];
  let shutdowns = 0;
  const fetchImpl = async (url) => {
    if (String(url).endsWith("update.json")) {
      return new Response(JSON.stringify(manifest), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(archive, {
      headers: { "Content-Length": String(archive.length) },
    });
  };
  try {
    const service = new UpdateService({
      currentVersion: APP_VERSION,
      platform: "win32",
      installRoot,
      updaterPath,
      manifestUrl: "https://example.com/update.json",
      fetchImpl,
      launchUpdater: (options) => launches.push(options),
      requestShutdown: () => { shutdowns += 1; },
    });

    assert.equal((await service.getStatus()).status, "available");
    assert.equal((await service.startDownload()).status, "downloading");
    for (let attempt = 0; attempt < 50 && service.snapshot().status === "downloading"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const ready = service.snapshot();
    assert.equal(ready.status, "ready");
    assert.equal(ready.progress, 100);
    const archivePath = fs.readdirSync(path.join(installRoot, "updates"))[0];
    assert.match(archivePath, /Moonsea-Codex-9\.0\.0-Windows-x64\.zip/);

    const installing = await service.startInstall();
    assert.equal(installing.status, "installing");
    assert.equal(launches.length, 1);
    assert.equal(launches[0].installRoot, installRoot);
    assert.equal(shutdowns, 1);
  } finally {
    fs.rmSync(installRoot, { recursive: true, force: true });
  }
});

test("校验失败时不留下可安装的更新包", async () => {
  const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-update-corrupt-"));
  const archive = Buffer.from("corrupt");
  const manifest = manifestFor(Buffer.from("expected"));
  const service = new UpdateService({
    currentVersion: APP_VERSION,
    platform: "win32",
    installRoot,
    updaterPath: path.join(installRoot, "updater.ps1"),
    manifestUrl: "https://example.com/update.json",
    fetchImpl: async (url) => String(url).endsWith("update.json")
      ? new Response(JSON.stringify(manifest))
      : new Response(archive),
    launchUpdater: () => {},
    requestShutdown: () => {},
  });
  try {
    await service.startDownload();
    for (let attempt = 0; attempt < 50 && service.snapshot().status === "downloading"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(service.snapshot().status, "error");
    assert.match(service.snapshot().error, /大小|校验|不完整/);
    assert.deepEqual(fs.readdirSync(path.join(installRoot, "updates")), []);
  } finally {
    fs.rmSync(installRoot, { recursive: true, force: true });
  }
});
