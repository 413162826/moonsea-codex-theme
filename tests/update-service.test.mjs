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
  const archive = Buffer.from("corrupt!");
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

test("重启助手后复用已经校验完成的更新包", async () => {
  const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-update-reuse-"));
  const updaterPath = path.join(installRoot, "updater.ps1");
  const archive = Buffer.from("verified-moonsea-package");
  const manifest = manifestFor(archive);
  const updatesRoot = path.join(installRoot, "updates");
  const packagePath = path.join(updatesRoot, "Moonsea-Codex-9.0.0-Windows-x64.zip");
  fs.mkdirSync(updatesRoot, { recursive: true });
  fs.writeFileSync(updaterPath, "test", "utf8");
  fs.writeFileSync(packagePath, archive);
  let packageDownloads = 0;
  const service = new UpdateService({
    currentVersion: APP_VERSION,
    platform: "win32",
    installRoot,
    updaterPath,
    manifestUrl: "https://example.com/update.json",
    fetchImpl: async (url) => {
      if (String(url).endsWith("update.json")) return new Response(JSON.stringify(manifest));
      packageDownloads += 1;
      return new Response(archive);
    },
    launchUpdater: async () => {},
    requestShutdown: () => {},
  });
  try {
    assert.equal((await service.getStatus()).status, "ready");
    assert.equal((await service.startDownload()).status, "ready");
    assert.equal(packageDownloads, 0);
  } finally {
    fs.rmSync(installRoot, { recursive: true, force: true });
  }
});

test("网络中断后从 partial 文件继续下载", async () => {
  const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-update-resume-"));
  const updaterPath = path.join(installRoot, "updater.ps1");
  const archive = Buffer.from("verified-moonsea-package");
  const partial = archive.subarray(0, 9);
  const manifest = manifestFor(archive);
  const updatesRoot = path.join(installRoot, "updates");
  const partialPath = path.join(updatesRoot, "Moonsea-Codex-9.0.0-Windows-x64.zip.partial");
  fs.mkdirSync(updatesRoot, { recursive: true });
  fs.writeFileSync(updaterPath, "test", "utf8");
  fs.writeFileSync(partialPath, partial);
  let requestedRange = null;
  const service = new UpdateService({
    currentVersion: APP_VERSION,
    platform: "win32",
    installRoot,
    updaterPath,
    manifestUrl: "https://example.com/update.json",
    fetchImpl: async (url, options = {}) => {
      if (String(url).endsWith("update.json")) return new Response(JSON.stringify(manifest));
      requestedRange = options.headers?.Range ?? null;
      return new Response(archive.subarray(partial.length), {
        status: 206,
        headers: { "Content-Range": `bytes ${partial.length}-${archive.length - 1}/${archive.length}` },
      });
    },
    launchUpdater: async () => {},
    requestShutdown: () => {},
  });
  try {
    await service.getStatus();
    await service.startDownload();
    for (let attempt = 0; attempt < 50 && service.snapshot().status === "downloading"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(requestedRange, `bytes=${partial.length}-`);
    assert.equal(service.snapshot().status, "ready");
  } finally {
    fs.rmSync(installRoot, { recursive: true, force: true });
  }
});

test("下载连接中断时保留进度并显示可操作的中文错误", async () => {
  const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-update-interrupted-"));
  const updaterPath = path.join(installRoot, "updater.ps1");
  const archive = Buffer.from("verified-moonsea-package");
  const manifest = manifestFor(archive);
  fs.writeFileSync(updaterPath, "test", "utf8");
  const service = new UpdateService({
    currentVersion: APP_VERSION,
    platform: "win32",
    installRoot,
    updaterPath,
    manifestUrl: "https://example.com/update.json",
    fetchImpl: async (url) => {
      if (String(url).endsWith("update.json")) return new Response(JSON.stringify(manifest));
      let sent = false;
      return new Response(new ReadableStream({
        pull(controller) {
          if (!sent) {
            sent = true;
            controller.enqueue(archive.subarray(0, 9));
            return;
          }
          controller.error(new TypeError("fetch failed"));
        },
      }));
    },
    launchUpdater: async () => {},
    requestShutdown: () => {},
  });
  try {
    await service.getStatus();
    await service.startDownload();
    for (let attempt = 0; attempt < 50 && service.snapshot().status === "downloading"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const status = service.snapshot();
    assert.equal(status.status, "error");
    assert.match(status.error, /网络连接异常/);
    assert.ok(status.progress > 0);
    assert.equal(
      fs.existsSync(path.join(installRoot, "updates", "Moonsea-Codex-9.0.0-Windows-x64.zip.partial")),
      true,
    );
  } finally {
    fs.rmSync(installRoot, { recursive: true, force: true });
  }
});

test("更新器握手失败时保留助手和已下载更新包", async () => {
  const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-update-handshake-"));
  const updaterPath = path.join(installRoot, "updater.ps1");
  const archive = Buffer.from("verified-moonsea-package");
  const manifest = manifestFor(archive);
  let shutdowns = 0;
  fs.writeFileSync(updaterPath, "test", "utf8");
  const service = new UpdateService({
    currentVersion: APP_VERSION,
    platform: "win32",
    installRoot,
    updaterPath,
    manifestUrl: "https://example.com/update.json",
    fetchImpl: async (url) => String(url).endsWith("update.json")
      ? new Response(JSON.stringify(manifest))
      : new Response(archive),
    launchUpdater: async () => { throw new Error("spawn failed"); },
    requestShutdown: () => { shutdowns += 1; },
  });
  try {
    await service.getStatus();
    await service.startDownload();
    for (let attempt = 0; attempt < 50 && service.snapshot().status === "downloading"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const result = await service.startInstall();
    assert.equal(result.status, "ready");
    assert.match(result.error, /spawn failed/);
    assert.equal(shutdowns, 0);
    assert.equal(fs.existsSync(service.packagePath), true);
  } finally {
    fs.rmSync(installRoot, { recursive: true, force: true });
  }
});

test("一次点击在下载完成后自动启动安装", async () => {
  const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-update-one-click-"));
  const updaterPath = path.join(installRoot, "updater.ps1");
  const archive = Buffer.from("verified-moonsea-package");
  const manifest = manifestFor(archive);
  let launches = 0;
  let shutdowns = 0;
  fs.writeFileSync(updaterPath, "test", "utf8");
  const service = new UpdateService({
    currentVersion: APP_VERSION,
    platform: "win32",
    installRoot,
    updaterPath,
    manifestUrl: "https://example.com/update.json",
    fetchImpl: async (url) => String(url).endsWith("update.json")
      ? new Response(JSON.stringify(manifest))
      : new Response(archive),
    launchUpdater: async () => { launches += 1; },
    requestShutdown: () => { shutdowns += 1; },
  });
  try {
    await service.getStatus();
    await service.startDownload({ autoInstall: true });
    for (let attempt = 0; attempt < 50 && shutdowns === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(launches, 1);
    assert.equal(shutdowns, 1);
    assert.equal(service.snapshot().status, "installing");
  } finally {
    fs.rmSync(installRoot, { recursive: true, force: true });
  }
});

test("回滚后的助手明确显示上次更新失败并允许复用安装包", async () => {
  const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-update-result-"));
  const updaterPath = path.join(installRoot, "updater.ps1");
  const archive = Buffer.from("verified-moonsea-package");
  const manifest = manifestFor(archive);
  const updatesRoot = path.join(installRoot, "updates");
  fs.mkdirSync(updatesRoot, { recursive: true });
  fs.writeFileSync(updaterPath, "test", "utf8");
  fs.writeFileSync(path.join(updatesRoot, "Moonsea-Codex-9.0.0-Windows-x64.zip"), archive);
  fs.writeFileSync(path.join(updatesRoot, "update-result.json"), JSON.stringify({
    status: "failed",
    currentVersion: APP_VERSION,
    targetVersion: "9.0.0",
  }));
  const service = new UpdateService({
    currentVersion: APP_VERSION,
    platform: "win32",
    installRoot,
    updaterPath,
    manifestUrl: "https://example.com/update.json",
    fetchImpl: async () => new Response(JSON.stringify(manifest)),
    launchUpdater: async () => {},
    requestShutdown: () => {},
  });
  try {
    const status = await service.getStatus();
    assert.equal(status.status, "ready");
    assert.match(status.error, /上次更新未完成/);
  } finally {
    fs.rmSync(installRoot, { recursive: true, force: true });
  }
});
