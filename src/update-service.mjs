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

  async getStatus({ force = false } = {}) {
    const stale = this.state.checkedAt === null
      || this.now() - this.state.checkedAt > CHECK_INTERVAL_MS;
    if (
      force
      || (stale && !["downloading", "ready", "installing"].includes(this.state.status))
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
      this.state = {
        status: available ? "available" : "current",
        latestVersion: selected.version,
        notes: selected.notes,
        progress: available ? 0 : 100,
        error: null,
        checkedAt: this.now(),
      };
    } catch (error) {
      this.state = {
        ...this.state,
        status: "error",
        error: error?.message || "暂时无法检查更新",
        checkedAt: this.now(),
      };
    }
    return this.snapshot();
  }

  async startDownload() {
    await this.getStatus({ force: this.state.status === "error" });
    if (this.state.status === "current") return this.snapshot();
    if (this.state.status === "ready" || this.state.status === "downloading") return this.snapshot();
    if (this.state.status !== "available" || !this.selectedUpdate) {
      throw new Error(this.state.error || "还没有可下载的更新");
    }

    const updatesRoot = path.join(this.installRoot, "updates");
    fs.mkdirSync(updatesRoot, { recursive: true });
    const extension = this.platform === "darwin" ? "macOS.zip" : "Windows-x64.zip";
    const packagePath = path.join(
      updatesRoot,
      `Moonsea-Codex-${this.selectedUpdate.version}-${extension}`,
    );
    const temporaryPath = `${packagePath}.partial`;
    this.state = { ...this.state, status: "downloading", progress: 0, error: null };
    this.downloadPromise = this.downloadPackage(temporaryPath, packagePath)
      .catch((error) => {
        fs.rmSync(temporaryPath, { force: true });
        this.state = {
          ...this.state,
          status: "error",
          progress: 0,
          error: error?.message || "更新包下载失败",
        };
      })
      .finally(() => {
        this.downloadPromise = null;
      });
    return this.snapshot();
  }

  async downloadPackage(temporaryPath, packagePath) {
    const response = await this.fetchImpl(this.selectedUpdate.package.url, { redirect: "follow" });
    if (!response.ok || !response.body) throw new Error(`更新包下载失败（${response.status}）`);
    const hash = crypto.createHash("sha256");
    const output = fs.createWriteStream(temporaryPath, { flags: "w" });
    let received = 0;
    try {
      for await (const chunk of response.body) {
        const buffer = Buffer.from(chunk);
        received += buffer.length;
        if (received > this.selectedUpdate.package.size) throw new Error("更新包大小与清单不一致");
        hash.update(buffer);
        if (!output.write(buffer)) await new Promise((resolve) => output.once("drain", resolve));
        this.state.progress = Math.min(
          99,
          Math.round((received / this.selectedUpdate.package.size) * 100),
        );
      }
      await new Promise((resolve, reject) => {
        output.end(resolve);
        output.once("error", reject);
      });
    } catch (error) {
      output.destroy();
      throw error;
    }
    if (received !== this.selectedUpdate.package.size) throw new Error("更新包下载不完整");
    if (hash.digest("hex") !== this.selectedUpdate.package.sha256) {
      throw new Error("更新包完整性校验失败");
    }
    fs.rmSync(packagePath, { force: true });
    fs.renameSync(temporaryPath, packagePath);
    this.packagePath = packagePath;
    this.state = { ...this.state, status: "ready", progress: 100, error: null };
  }

  async startInstall() {
    if (this.state.status !== "ready" || !this.packagePath || !this.selectedUpdate) {
      throw new Error("更新包还没有准备好");
    }
    if (!fs.existsSync(this.updaterPath)) throw new Error("月海更新程序缺失，请重新安装迁移版");
    this.launchUpdater({
      updaterPath: this.updaterPath,
      installRoot: this.installRoot,
      packagePath: this.packagePath,
      currentVersion: this.currentVersion,
      targetVersion: this.selectedUpdate.version,
    });
    this.state = { ...this.state, status: "installing", error: null };
    this.requestShutdown();
    return this.snapshot();
  }
}
