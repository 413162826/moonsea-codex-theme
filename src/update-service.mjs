import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_UPDATE_MANIFEST_URL =
  "https://github.com/413162826/moonsea-codex-theme/releases/latest/download/update.json";

const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const PLATFORM_KEYS = new Map([
  ["win32", "windows"],
  ["darwin", "macos"],
]);

export function compareVersions(left, right) {
  const parse = (value) => {
    const match = String(value).match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
    if (!match) throw new Error(`版本号无效：${value}`);
    return {
      numbers: match.slice(1, 4).map(Number),
      prerelease: match[4] ?? null,
    };
  };
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if (a.numbers[index] !== b.numbers[index]) {
      return Math.sign(a.numbers[index] - b.numbers[index]);
    }
  }
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;
  return a.prerelease.localeCompare(b.prerelease, "en", { numeric: true });
}

function assertHttpsUrl(value, label) {
  const url = new URL(value);
  const local = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) throw new Error(`${label}必须使用 HTTPS`);
  return url.toString();
}

function readableUpdateError(error, action) {
  const message = error?.message || "未知错误";
  if (/\p{Script=Han}/u.test(message)) return message;
  if (error?.name === "AbortError" || error?.name === "TimeoutError" || error instanceof TypeError) {
    return `${action}失败：网络连接异常，请稍后重试`;
  }
  return `${action}失败：${message}`;
}

export function validateUpdateManifest(manifest, platform, currentVersion) {
  const platformKey = PLATFORM_KEYS.get(platform);
  if (!platformKey) throw new Error("当前系统暂不支持自动更新");
  if (manifest?.schemaVersion !== 1) throw new Error("更新清单版本不受支持");
  compareVersions(manifest.version, currentVersion);
  const entry = manifest.platforms?.[platformKey];
  if (!entry) throw new Error("更新清单缺少当前系统安装包");
  if (!/^[a-f0-9]{64}$/.test(entry.sha256 ?? "")) throw new Error("更新包校验值无效");
  if (!Number.isSafeInteger(entry.size) || entry.size <= 0) throw new Error("更新包大小无效");
  return {
    version: manifest.version,
    notes: typeof manifest.notes === "string" ? manifest.notes.slice(0, 500) : "月海助手体验更新",
    publishedAt: typeof manifest.publishedAt === "string" ? manifest.publishedAt : null,
    package: {
      url: assertHttpsUrl(entry.url, "更新包地址"),
      sha256: entry.sha256,
      size: entry.size,
    },
  };
}

function publicSnapshot(state, currentVersion) {
  return {
    currentVersion,
    status: state.status,
    latestVersion: state.latestVersion,
    notes: state.notes,
    progress: state.progress,
    error: state.error,
    checkedAt: state.checkedAt,
  };
}

async function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

export class UpdateService {
  constructor({
    currentVersion,
    platform,
    installRoot,
    updaterPath,
    manifestUrl = process.env.MOONSEA_UPDATE_MANIFEST_URL ?? DEFAULT_UPDATE_MANIFEST_URL,
    fetchImpl = globalThis.fetch,
    launchUpdater,
    requestShutdown,
    now = () => Date.now(),
  }) {
    this.currentVersion = currentVersion;
    this.platform = platform;
    this.installRoot = path.resolve(installRoot);
    this.updaterPath = path.resolve(updaterPath);
    this.manifestUrl = assertHttpsUrl(manifestUrl, "更新清单地址");
    this.fetchImpl = fetchImpl;
    this.launchUpdater = launchUpdater;
    this.requestShutdown = requestShutdown;
    this.now = now;
    this.selectedUpdate = null;
    this.packagePath = null;
    this.downloadPromise = null;
    this.state = {
      status: "checking",
      latestVersion: currentVersion,
      notes: "",
      progress: 0,
      error: null,
      checkedAt: null,
    };
  }

  snapshot() {
    return publicSnapshot(this.state, this.currentVersion);
  }

  packagePathFor(update = this.selectedUpdate) {
    if (!update) return null;
    const extension = this.platform === "darwin" ? "macOS.zip" : "Windows-x64.zip";
    return path.join(
      this.installRoot,
      "updates",
      `Moonsea-Codex-${update.version}-${extension}`,
    );
  }

  async restoreDownloadedPackage() {
    const packagePath = this.packagePathFor();
    if (!packagePath || !fs.existsSync(packagePath)) return false;
    const stat = fs.statSync(packagePath);
    const valid = stat.isFile()
      && stat.size === this.selectedUpdate.package.size
      && await hashFile(packagePath) === this.selectedUpdate.package.sha256;
    if (!valid) {
      fs.rmSync(packagePath, { force: true });
      return false;
    }
    this.packagePath = packagePath;
    return true;
  }

  readPreviousFailure(targetVersion) {
    const resultPath = path.join(this.installRoot, "updates", "update-result.json");
    if (!fs.existsSync(resultPath)) return null;
    try {
      const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
      if (
        result?.status === "failed"
        && result.currentVersion === this.currentVersion
        && result.targetVersion === targetVersion
      ) {
        return "上次更新未完成，已经自动恢复到当前版本。可重试安装，详情见 updates/update.log。";
      }
    } catch { }
    return null;
  }

  async getStatus({ force = false } = {}) {
    const stale = this.state.checkedAt === null
      || this.now() - this.state.checkedAt > CHECK_INTERVAL_MS;
    if (
      force
      || (stale && !["downloading", "ready", "starting", "installing"].includes(this.state.status))
    ) {
      await this.check();
    }
    return this.snapshot();
  }

  async check() {
    this.state = { ...this.state, status: "checking", error: null };
    try {
      const response = await this.fetchImpl(this.manifestUrl, {
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`检查更新失败（${response.status}）`);
      const selected = validateUpdateManifest(
        await response.json(),
        this.platform,
        this.currentVersion,
      );
      this.selectedUpdate = selected;
      const available = compareVersions(selected.version, this.currentVersion) > 0;
      const ready = available && await this.restoreDownloadedPackage();
      const previousFailure = ready ? this.readPreviousFailure(selected.version) : null;
      this.state = {
        status: ready ? "ready" : available ? "available" : "current",
        latestVersion: selected.version,
        notes: selected.notes,
        progress: ready || !available ? 100 : 0,
        error: previousFailure,
        checkedAt: this.now(),
      };
    } catch (error) {
      this.state = {
        ...this.state,
        status: "error",
        error: readableUpdateError(error, "检查更新"),
        checkedAt: this.now(),
      };
    }
    return this.snapshot();
  }

  async startDownload({ autoInstall = false } = {}) {
    await this.getStatus({ force: this.state.status === "error" });
    if (this.state.status === "current") return this.snapshot();
    if (this.state.status === "ready") {
      if (autoInstall) void this.startInstall();
      return this.snapshot();
    }
    if (this.state.status === "downloading") return this.snapshot();
    if (this.state.status !== "available" || !this.selectedUpdate) {
      throw new Error(this.state.error || "还没有可下载的更新");
    }

    if (await this.restoreDownloadedPackage()) {
      this.state = { ...this.state, status: "ready", progress: 100, error: null };
      if (autoInstall) void this.startInstall();
      return this.snapshot();
    }

    const updatesRoot = path.join(this.installRoot, "updates");
    fs.mkdirSync(updatesRoot, { recursive: true });
    const packagePath = this.packagePathFor();
    const temporaryPath = `${packagePath}.partial`;
    const partialSize = fs.existsSync(temporaryPath) ? fs.statSync(temporaryPath).size : 0;
    if (partialSize > this.selectedUpdate.package.size) fs.rmSync(temporaryPath, { force: true });
    const resumeSize = partialSize <= this.selectedUpdate.package.size ? partialSize : 0;
    this.state = {
      ...this.state,
      status: "downloading",
      progress: Math.min(99, Math.round((resumeSize / this.selectedUpdate.package.size) * 100)),
      error: null,
    };
    this.downloadPromise = this.downloadPackage(temporaryPath, packagePath)
      .then(async () => {
        if (autoInstall && this.state.status === "ready") await this.startInstall();
      })
      .catch((error) => {
        this.state = {
          ...this.state,
          status: "error",
          progress: fs.existsSync(temporaryPath)
            ? Math.min(99, Math.round((fs.statSync(temporaryPath).size / this.selectedUpdate.package.size) * 100))
            : 0,
          error: readableUpdateError(error, "下载更新"),
        };
      })
      .finally(() => {
        this.downloadPromise = null;
      });
    return this.snapshot();
  }

  async downloadPackage(temporaryPath, packagePath) {
    const expectedSize = this.selectedUpdate.package.size;
    let received = fs.existsSync(temporaryPath) ? fs.statSync(temporaryPath).size : 0;
    if (received === expectedSize) {
      if (await hashFile(temporaryPath) === this.selectedUpdate.package.sha256) {
        fs.rmSync(packagePath, { force: true });
        fs.renameSync(temporaryPath, packagePath);
        this.packagePath = packagePath;
        this.state = { ...this.state, status: "ready", progress: 100, error: null };
        return;
      }
      fs.rmSync(temporaryPath, { force: true });
      received = 0;
    }

    const response = await this.fetchImpl(this.selectedUpdate.package.url, {
      redirect: "follow",
      headers: received > 0 ? { Range: `bytes=${received}-` } : undefined,
      signal: AbortSignal.timeout(10 * 60 * 1000),
    });
    if (!response.ok || !response.body) throw new Error(`更新包下载失败（${response.status}）`);
    const hash = crypto.createHash("sha256");
    let append = received > 0 && response.status === 206;
    if (append) {
      const contentRange = response.headers.get("content-range") ?? "";
      if (!contentRange.startsWith(`bytes ${received}-`)) {
        throw new Error("更新服务器返回的断点位置无效");
      }
      for await (const chunk of fs.createReadStream(temporaryPath)) hash.update(chunk);
    } else if (received > 0) {
      received = 0;
      append = false;
    }
    const output = fs.createWriteStream(temporaryPath, { flags: append ? "a" : "w" });
    try {
      for await (const chunk of response.body) {
        const buffer = Buffer.from(chunk);
        received += buffer.length;
        if (received > expectedSize) {
          const error = new Error("更新包大小与清单不一致");
          error.invalidatePartial = true;
          throw error;
        }
        hash.update(buffer);
        if (!output.write(buffer)) await new Promise((resolve) => output.once("drain", resolve));
        this.state.progress = Math.min(
          99,
          Math.round((received / expectedSize) * 100),
        );
      }
      await new Promise((resolve, reject) => {
        output.end(resolve);
        output.once("error", reject);
      });
    } catch (error) {
      if (error.invalidatePartial) {
        await new Promise((resolve) => {
          output.once("close", resolve);
          output.destroy();
        });
        fs.rmSync(temporaryPath, { force: true });
      } else {
        await new Promise((resolve) => {
          output.once("error", resolve);
          output.end(resolve);
        });
      }
      throw error;
    }
    if (received !== expectedSize) throw new Error("网络中断，已保留下载进度，请重试");
    if (hash.digest("hex") !== this.selectedUpdate.package.sha256) {
      fs.rmSync(temporaryPath, { force: true });
      throw new Error("更新包完整性校验失败");
    }
    fs.rmSync(packagePath, { force: true });
    fs.renameSync(temporaryPath, packagePath);
    this.packagePath = packagePath;
    this.state = { ...this.state, status: "ready", progress: 100, error: null };
  }

  async startInstall() {
    try {
      if (this.state.status !== "ready" || !this.packagePath || !this.selectedUpdate) {
        throw new Error("更新包还没有准备好");
      }
      if (!fs.existsSync(this.updaterPath)) throw new Error("月海更新程序缺失，请重新安装月海版");
      this.state = { ...this.state, status: "starting", error: null };
      await this.launchUpdater({
        updaterPath: this.updaterPath,
        installRoot: this.installRoot,
        packagePath: this.packagePath,
        currentVersion: this.currentVersion,
        targetVersion: this.selectedUpdate.version,
      });
      this.state = { ...this.state, status: "installing", error: null };
      this.requestShutdown();
    } catch (error) {
      this.state = {
        ...this.state,
        status: this.packagePath && fs.existsSync(this.packagePath) ? "ready" : "error",
        error: `更新程序没有启动：${error?.message || "未知错误"}。详情见 updates/updater-launch.log。`,
      };
    }
    return this.snapshot();
  }
}
