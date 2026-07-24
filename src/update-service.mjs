import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_UPDATE_MANIFEST_URL =
  "https://github.com/413162826/moonsea-codex-theme/releases/latest/download/update.json";

const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const MANIFEST_MAX_ATTEMPTS = 3;
const DEFAULT_DOWNLOAD_POLICY = Object.freeze({
  maxAttempts: 5,
  connectTimeoutMs: 30_000,
  idleTimeoutMs: 45_000,
  retryBaseDelayMs: 1_000,
  retryMaxDelayMs: 8_000,
});
const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
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
  if (error?.userMessage) return error.userMessage;
  const message = error?.message || "未知错误";
  if (/\p{Script=Han}/u.test(message)) return message;
  if (error?.name === "AbortError" || error?.name === "TimeoutError" || error instanceof TypeError) {
    return `${action}失败：网络连接异常，请稍后重试`;
  }
  return `${action}失败：${message}`;
}

function updateError(message, options = {}) {
  const error = new Error(message, options.cause ? { cause: options.cause } : undefined);
  Object.assign(error, {
    code: options.code ?? null,
    retryable: options.retryable === true,
    invalidatePartial: options.invalidatePartial === true,
    retryAfterMs: options.retryAfterMs ?? null,
    userMessage: options.userMessage ?? null,
  });
  return error;
}

function parseRetryAfter(value, now) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 30_000);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.min(Math.max(0, timestamp - now()), 30_000);
}

function isRetryableNetworkError(error) {
  return error?.retryable === true
    || error?.name === "AbortError"
    || error?.name === "TimeoutError"
    || error instanceof TypeError;
}

function validateContentRange(value, expectedStart, expectedSize) {
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value ?? "");
  if (!match) return false;
  const [, start, end, total] = match.map(Number);
  return start === expectedStart
    && end >= start
    && end < total
    && total === expectedSize;
}

export function validateUpdateManifest(manifest, platform, currentVersion) {
  const platformKey = PLATFORM_KEYS.get(platform);
  if (!platformKey) throw new Error("当前系统暂不支持自动更新");
  if (manifest?.schemaVersion !== 1) throw new Error("更新清单版本不受支持");
  compareVersions(manifest.version, currentVersion);
  const entry = manifest.platforms?.[platformKey];
  if (!entry) throw new Error("更新清单缺少当前系统安装包");
  const packageEntry = platformKey === "windows" && entry.installer
    ? entry.installer
    : entry;
  const kind = platformKey === "windows" && entry.installer ? "installer" : "archive";
  if (!/^[a-f0-9]{64}$/.test(packageEntry.sha256 ?? "")) throw new Error("更新包校验值无效");
  if (!Number.isSafeInteger(packageEntry.size) || packageEntry.size <= 0) throw new Error("更新包大小无效");
  const packageUrl = assertHttpsUrl(packageEntry.url, "更新包地址");
  if (kind === "installer" && !new URL(packageUrl).pathname.toLowerCase().endsWith(".exe")) {
    throw new Error("Windows 更新安装器必须是 EXE 文件");
  }
  return {
    version: manifest.version,
    notes: typeof manifest.notes === "string" ? manifest.notes.slice(0, 500) : "月海助手体验更新",
    publishedAt: typeof manifest.publishedAt === "string" ? manifest.publishedAt : null,
    package: {
      kind,
      url: packageUrl,
      sha256: packageEntry.sha256,
      size: packageEntry.size,
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
    phase: state.phase,
    downloadedBytes: state.downloadedBytes,
    totalBytes: state.totalBytes,
    speedBytesPerSecond: state.speedBytesPerSecond,
    retryAttempt: state.retryAttempt,
    maxRetryAttempts: state.maxRetryAttempts,
    nextRetryAt: state.nextRetryAt,
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
    sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration)),
    downloadPolicy = {},
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
    this.sleep = sleep;
    this.downloadPolicy = {
      ...DEFAULT_DOWNLOAD_POLICY,
      ...downloadPolicy,
    };
    if (!Number.isInteger(this.downloadPolicy.maxAttempts) || this.downloadPolicy.maxAttempts < 1) {
      throw new Error("下载最大尝试次数必须是正整数");
    }
    this.selectedUpdate = null;
    this.packagePath = null;
    this.downloadPromise = null;
    this.state = {
      status: "checking",
      latestVersion: currentVersion,
      notes: "",
      progress: 0,
      phase: null,
      downloadedBytes: 0,
      totalBytes: 0,
      speedBytesPerSecond: 0,
      retryAttempt: 0,
      maxRetryAttempts: this.downloadPolicy.maxAttempts - 1,
      nextRetryAt: null,
      error: null,
      checkedAt: null,
    };
  }

  snapshot() {
    return publicSnapshot(this.state, this.currentVersion);
  }

  packagePathFor(update = this.selectedUpdate) {
    if (!update) return null;
    const extension = this.platform === "darwin"
      ? "macOS.zip"
      : update.package.kind === "installer"
        ? "Windows-x64-Setup.exe"
        : "Windows-x64.zip";
    return path.join(
      this.installRoot,
      "updates",
      `Moonsea-Codex-${update.version}-${extension}`,
    );
  }

  partialPathFor(update = this.selectedUpdate) {
    const packagePath = this.packagePathFor(update);
    return packagePath ? `${packagePath}.partial` : null;
  }

  appendDownloadLog(event, details = {}) {
    try {
      const updatesRoot = path.join(this.installRoot, "updates");
      fs.mkdirSync(updatesRoot, { recursive: true });
      fs.appendFileSync(
        path.join(updatesRoot, "download.log"),
        `${JSON.stringify({
          timestamp: new Date(this.now()).toISOString(),
          event,
          currentVersion: this.currentVersion,
          targetVersion: this.selectedUpdate?.version ?? null,
          ...details,
        })}\n`,
        "utf8",
      );
    } catch { }
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
      const response = await this.fetchUpdateManifest();
      const selected = validateUpdateManifest(
        await response.json(),
        this.platform,
        this.currentVersion,
      );
      this.selectedUpdate = selected;
      const available = compareVersions(selected.version, this.currentVersion) > 0;
      const ready = available && await this.restoreDownloadedPackage();
      const partialPath = this.partialPathFor(selected);
      const partialSize = available
        && !ready
        && partialPath
        && fs.existsSync(partialPath)
        ? Math.min(fs.statSync(partialPath).size, selected.package.size)
        : 0;
      const previousFailure = ready ? this.readPreviousFailure(selected.version) : null;
      this.state = {
        status: ready ? "ready" : available ? "available" : "current",
        latestVersion: selected.version,
        notes: selected.notes,
        progress: ready || !available
          ? 100
          : Math.round((partialSize / selected.package.size) * 100),
        phase: null,
        downloadedBytes: ready ? selected.package.size : partialSize,
        totalBytes: available ? selected.package.size : 0,
        speedBytesPerSecond: 0,
        retryAttempt: 0,
        maxRetryAttempts: this.downloadPolicy.maxAttempts - 1,
        nextRetryAt: null,
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

  async fetchUpdateManifest() {
    let lastError = null;
    for (let attempt = 1; attempt <= MANIFEST_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await this.fetchImpl(this.manifestUrl, {
          cache: "no-store",
          redirect: "follow",
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
          throw updateError(`检查更新失败（${response.status}）`, {
            code: `HTTP_${response.status}`,
            retryable: RETRYABLE_HTTP_STATUS.has(response.status),
            retryAfterMs: parseRetryAfter(response.headers.get("retry-after"), this.now),
          });
        }
        return response;
      } catch (error) {
        lastError = error;
        const retryable = isRetryableNetworkError(error);
        this.appendDownloadLog("update_check_attempt_failed", {
          attempt,
          retryable,
          errorName: error?.name ?? "Error",
          errorCode: error?.code ?? error?.cause?.code ?? null,
          errorMessage: error?.message ?? String(error),
        });
        if (!retryable || attempt >= MANIFEST_MAX_ATTEMPTS) throw error;
        const delay = error.retryAfterMs === null
          ? 500 * (2 ** (attempt - 1))
          : Math.min(error.retryAfterMs, 5_000);
        await this.sleep(delay);
      }
    }
    throw lastError;
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
      phase: "downloading",
      downloadedBytes: resumeSize,
      totalBytes: this.selectedUpdate.package.size,
      speedBytesPerSecond: 0,
      retryAttempt: 0,
      maxRetryAttempts: this.downloadPolicy.maxAttempts - 1,
      nextRetryAt: null,
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
          phase: null,
          downloadedBytes: fs.existsSync(temporaryPath) ? fs.statSync(temporaryPath).size : 0,
          speedBytesPerSecond: 0,
          nextRetryAt: null,
          error: readableUpdateError(error, "下载更新"),
        };
        this.appendDownloadLog("download_failed", {
          downloadedBytes: this.state.downloadedBytes,
          errorName: error?.name ?? "Error",
          errorCode: error?.code ?? error?.cause?.code ?? null,
          errorMessage: error?.message ?? String(error),
        });
      })
      .finally(() => {
        this.downloadPromise = null;
      });
    return this.snapshot();
  }

  async downloadPackage(temporaryPath, packagePath) {
    const expectedSize = this.selectedUpdate.package.size;
    const existingSize = fs.existsSync(temporaryPath) ? fs.statSync(temporaryPath).size : 0;
    if (existingSize === expectedSize) {
      if (await hashFile(temporaryPath) === this.selectedUpdate.package.sha256) {
        fs.rmSync(packagePath, { force: true });
        fs.renameSync(temporaryPath, packagePath);
        this.packagePath = packagePath;
        this.state = {
          ...this.state,
          status: "ready",
          progress: 100,
          phase: null,
          downloadedBytes: expectedSize,
          speedBytesPerSecond: 0,
          retryAttempt: 0,
          nextRetryAt: null,
          error: null,
        };
        return;
      }
      fs.rmSync(temporaryPath, { force: true });
    }

    this.appendDownloadLog("download_started", {
      downloadedBytes: fs.existsSync(temporaryPath) ? fs.statSync(temporaryPath).size : 0,
      totalBytes: expectedSize,
    });

    for (let attempt = 1; attempt <= this.downloadPolicy.maxAttempts; attempt += 1) {
      try {
        this.state = {
          ...this.state,
          phase: "downloading",
          retryAttempt: attempt - 1,
          nextRetryAt: null,
        };
        await this.downloadAttempt(temporaryPath, expectedSize);
        const received = fs.existsSync(temporaryPath) ? fs.statSync(temporaryPath).size : 0;
        if (received !== expectedSize) {
          throw updateError("下载连接提前结束", {
            code: "DOWNLOAD_INCOMPLETE",
            retryable: true,
          });
        }
        this.state = {
          ...this.state,
          phase: "verifying",
          progress: 100,
          downloadedBytes: expectedSize,
          speedBytesPerSecond: 0,
          nextRetryAt: null,
        };
        if (await hashFile(temporaryPath) !== this.selectedUpdate.package.sha256) {
          fs.rmSync(temporaryPath, { force: true });
          throw updateError("更新包完整性校验失败，准备重新下载", {
            code: "PACKAGE_INTEGRITY_FAILED",
            retryable: true,
            userMessage: "安装包多次校验失败，请检查网络或安全软件后重新下载。",
          });
        }
        break;
      } catch (error) {
        if (error.invalidatePartial) fs.rmSync(temporaryPath, { force: true });
        const downloadedBytes = fs.existsSync(temporaryPath) ? fs.statSync(temporaryPath).size : 0;
        const retryable = isRetryableNetworkError(error);
        this.appendDownloadLog("download_attempt_failed", {
          attempt,
          downloadedBytes,
          retryable,
          errorName: error?.name ?? "Error",
          errorCode: error?.code ?? error?.cause?.code ?? null,
          errorMessage: error?.message ?? String(error),
        });
        if (!retryable || attempt >= this.downloadPolicy.maxAttempts) {
          if (retryable && !error.userMessage) {
            error.userMessage = downloadedBytes > 0
              ? `下载多次中断，已保留 ${Math.round((downloadedBytes / expectedSize) * 100)}% 进度。请检查网络后继续下载。`
              : "暂时无法连接更新服务器，请检查网络后重试。";
          }
          throw error;
        }
        const exponentialDelay = Math.min(
          this.downloadPolicy.retryBaseDelayMs * (2 ** (attempt - 1)),
          this.downloadPolicy.retryMaxDelayMs,
        );
        const delay = error.retryAfterMs === null
          ? exponentialDelay
          : Math.min(error.retryAfterMs, this.downloadPolicy.retryMaxDelayMs);
        this.state = {
          ...this.state,
          phase: "retrying",
          downloadedBytes,
          progress: Math.min(99, Math.round((downloadedBytes / expectedSize) * 100)),
          speedBytesPerSecond: 0,
          retryAttempt: attempt,
          nextRetryAt: this.now() + delay,
        };
        await this.sleep(delay);
      }
    }

    const received = fs.existsSync(temporaryPath) ? fs.statSync(temporaryPath).size : 0;
    if (received !== expectedSize) throw new Error("网络中断，已保留下载进度，请重试");
    fs.rmSync(packagePath, { force: true });
    fs.renameSync(temporaryPath, packagePath);
    this.packagePath = packagePath;
    this.state = {
      ...this.state,
      status: "ready",
      progress: 100,
      phase: null,
      downloadedBytes: expectedSize,
      speedBytesPerSecond: 0,
      retryAttempt: 0,
      nextRetryAt: null,
      error: null,
    };
    this.appendDownloadLog("download_completed", {
      downloadedBytes: expectedSize,
      totalBytes: expectedSize,
    });
  }

  async downloadAttempt(temporaryPath, expectedSize) {
    let received = fs.existsSync(temporaryPath) ? fs.statSync(temporaryPath).size : 0;
    const requestedStart = received;
    const controller = new AbortController();
    let timeout = null;
    let timeoutCode = null;
    const armTimeout = (duration, code) => {
      clearTimeout(timeout);
      timeoutCode = code;
      timeout = setTimeout(() => controller.abort(), duration);
      timeout.unref?.();
    };
    armTimeout(this.downloadPolicy.connectTimeoutMs, "DOWNLOAD_CONNECT_TIMEOUT");

    let response;
    try {
      response = await this.fetchImpl(this.selectedUpdate.package.url, {
        redirect: "follow",
        headers: requestedStart > 0 ? { Range: `bytes=${requestedStart}-` } : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      if (controller.signal.aborted) {
        throw updateError("连接更新服务器超时", {
          code: timeoutCode,
          retryable: true,
          cause: error,
        });
      }
      throw error;
    }

    if (response.status === 416 && requestedStart > 0) {
      clearTimeout(timeout);
      throw updateError("更新服务器拒绝了当前断点，准备重新下载", {
        code: "RANGE_NOT_SATISFIABLE",
        retryable: true,
        invalidatePartial: true,
      });
    }
    if (!response.ok || !response.body) {
      clearTimeout(timeout);
      throw updateError(`更新包下载失败（${response.status}）`, {
        code: `HTTP_${response.status}`,
        retryable: RETRYABLE_HTTP_STATUS.has(response.status),
        retryAfterMs: parseRetryAfter(response.headers.get("retry-after"), this.now),
      });
    }

    if (
      response.status === 206
      && !validateContentRange(
        response.headers.get("content-range"),
        requestedStart,
        expectedSize,
      )
    ) {
      clearTimeout(timeout);
      throw updateError("更新服务器返回的断点位置无效", {
        code: "INVALID_CONTENT_RANGE",
        retryable: true,
      });
    }
    clearTimeout(timeout);

    const append = requestedStart > 0 && response.status === 206;
    if (!append) received = 0;
    const attemptStartedAt = Date.now();
    const attemptStartedBytes = received;
    let output;
    try {
      output = await fs.promises.open(temporaryPath, append ? "a" : "w");
    } catch (error) {
      throw updateError("无法创建更新文件，请检查磁盘空间和目录权限", {
        code: error?.code ?? "DOWNLOAD_OPEN_FAILED",
        cause: error,
      });
    }
    const reader = response.body.getReader();
    let writeError = null;
    let completed = false;
    try {
      while (true) {
        let readTimeout = null;
        const result = await Promise.race([
          reader.read(),
          new Promise((resolve, reject) => {
            readTimeout = setTimeout(() => {
              timeoutCode = "DOWNLOAD_IDLE_TIMEOUT";
              controller.abort();
              reject(updateError("下载连接长时间没有响应", {
                code: timeoutCode,
                retryable: true,
              }));
            }, this.downloadPolicy.idleTimeoutMs);
            readTimeout.unref?.();
          }),
        ]).finally(() => clearTimeout(readTimeout));
        if (result.done) {
          completed = true;
          break;
        }
        const chunk = Buffer.from(result.value);
        received += chunk.length;
        if (received > expectedSize) {
          throw updateError("更新包大小与清单不一致", {
            code: "PACKAGE_SIZE_MISMATCH",
            invalidatePartial: true,
          });
        }
        const elapsedSeconds = Math.max((Date.now() - attemptStartedAt) / 1_000, 0.001);
        this.state = {
          ...this.state,
          phase: "downloading",
          progress: Math.min(99, Math.round((received / expectedSize) * 100)),
          downloadedBytes: received,
          totalBytes: expectedSize,
          speedBytesPerSecond: Math.round((received - attemptStartedBytes) / elapsedSeconds),
          nextRetryAt: null,
        };
        try {
          await output.write(chunk);
        } catch (error) {
          writeError = error;
          throw error;
        }
      }
    } catch (error) {
      if (controller.signal.aborted) {
        throw updateError("下载连接长时间没有响应", {
          code: timeoutCode,
          retryable: true,
          cause: error,
        });
      }
      if (writeError) {
        throw updateError("无法写入更新包，请检查磁盘空间和目录权限", {
          code: writeError.code ?? "DOWNLOAD_WRITE_FAILED",
          cause: writeError,
        });
      }
      if (error?.invalidatePartial) throw error;
      throw updateError(error?.message || "下载连接中断", {
        code: error?.code ?? "DOWNLOAD_STREAM_INTERRUPTED",
        retryable: error instanceof TypeError
          || error?.name === "AbortError"
          || error?.code === "ECONNRESET"
          || error?.code === "ETIMEDOUT"
          || error?.code === "UND_ERR_SOCKET",
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
      await output.close();
      if (!completed) void reader.cancel().catch(() => {});
    }
  }

  async startInstall() {
    try {
      if (this.state.status !== "ready" || !this.packagePath || !this.selectedUpdate) {
        throw new Error("更新包还没有准备好");
      }
      if (
        this.selectedUpdate.package.kind !== "installer"
        && !fs.existsSync(this.updaterPath)
      ) {
        throw new Error("月海更新程序缺失，请重新安装月海版");
      }
      this.state = { ...this.state, status: "starting", error: null };
      await this.launchUpdater({
        updaterPath: this.updaterPath,
        installRoot: this.installRoot,
        packagePath: this.packagePath,
        packageKind: this.selectedUpdate.package.kind,
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
