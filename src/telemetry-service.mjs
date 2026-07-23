import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const TELEMETRY_ENDPOINT = "https://moonsea-codex-theme.suguowen5.chatgpt.site/api/telemetry";
export const TELEMETRY_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const TELEMETRY_RETRY_MS = 5 * 60 * 1000;

function readState(statePath) {
  if (!fs.existsSync(statePath)) {
    return { installId: randomUUID(), lastReportedAt: null };
  }
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  if (typeof state.installId !== "string") throw new Error("匿名统计状态无效");
  return {
    installId: state.installId,
    lastReportedAt: Number.isFinite(state.lastReportedAt) ? state.lastReportedAt : null,
  };
}

function writeState(statePath, state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  fs.renameSync(temporaryPath, statePath);
}

export class TelemetryService {
  constructor({
    installRoot,
    appVersion,
    platform = process.platform,
    architecture = process.arch,
    endpoint = TELEMETRY_ENDPOINT,
    fetchImpl = fetch,
    now = Date.now,
  }) {
    this.statePath = path.join(installRoot, "telemetry.json");
    this.appVersion = appVersion;
    this.platform = platform;
    this.architecture = architecture;
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.nextAttemptAt = 0;
  }

  async sync(consent) {
    if (consent !== true) {
      this.nextAttemptAt = 0;
      return { status: "disabled" };
    }

    const currentTime = this.now();
    if (currentTime < this.nextAttemptAt) return { status: "waiting" };

    const state = readState(this.statePath);
    if (state.lastReportedAt && currentTime - state.lastReportedAt < TELEMETRY_INTERVAL_MS) {
      this.nextAttemptAt = state.lastReportedAt + TELEMETRY_INTERVAL_MS;
      return { status: "current" };
    }

    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `MoonseaCodex/${this.appVersion}`,
        },
        body: JSON.stringify({
          consent: true,
          installId: state.installId,
          platform: this.platform,
          architecture: this.architecture,
          appVersion: this.appVersion,
          channel: "stable",
        }),
      });
      if (!response.ok) throw new Error(`匿名统计服务返回 ${response.status}`);
      writeState(this.statePath, { ...state, lastReportedAt: currentTime });
      this.nextAttemptAt = currentTime + TELEMETRY_INTERVAL_MS;
      return { status: "reported" };
    } catch (error) {
      this.nextAttemptAt = currentTime + TELEMETRY_RETRY_MS;
      throw error;
    }
  }
}
