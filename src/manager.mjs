import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequestHandler, exchangeAssistantUpdate, MANAGER_PORT } from "./manager-core.mjs";
import { UpdateService } from "./update-service.mjs";
import { APP_VERSION } from "./version.mjs";

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function findProjectRoot() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const executableDir = path.dirname(process.execPath);
  const candidates = [
    process.env.MOONSEA_PROJECT_ROOT,
    moduleDir,
    path.dirname(moduleDir),
    executableDir,
    path.dirname(executableDir),
    process.cwd(),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(path.join(resolved, "site", "index.html"))) return resolved;
  }
  throw new Error("找不到月海主题网页资源");
}

const installRoot = path.resolve(
  readArgument("--install-root")
    ?? process.env.MOONSEA_INSTALL_ROOT
    ?? path.join(process.env.LOCALAPPDATA ?? process.cwd(), "MoonseaCodex"),
);
const profilePath = path.resolve(
  readArgument("--profile-path") ?? path.join(installRoot, "BrowserProfile"),
);
const projectRoot = findProjectRoot();
const pidPath = path.join(installRoot, "manager.pid");
const updaterPath = process.platform === "win32"
  ? path.join(projectRoot, "scripts", "windows", "Update-Moonsea-Windows.ps1")
  : path.join(projectRoot, "scripts", "macos", "update-moonsea.sh");

function launchUpdater({ packagePath, currentVersion, targetVersion }) {
  const readyPath = path.join(installRoot, "updates", `updater-${targetVersion}.ready`);
  const launchLogPath = path.join(installRoot, "updates", "updater-launch.log");
  fs.mkdirSync(path.dirname(readyPath), { recursive: true });
  fs.rmSync(readyPath, { force: true });
  const commonArguments = [
    "--install-root", installRoot,
    "--package-path", packagePath,
    "--manager-pid", String(process.pid),
    "--current-version", currentVersion,
    "--target-version", targetVersion,
    "--ready-path", readyPath,
  ];
  const command = process.platform === "win32"
    ? process.env.SystemRoot
      ? path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
      : "powershell.exe"
    : "/bin/zsh";
  const argumentsList = process.platform === "win32"
    ? [
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", updaterPath,
        "-InstallRoot", installRoot,
        "-PackagePath", packagePath,
        "-ManagerPid", String(process.pid),
        "-CurrentVersion", currentVersion,
        "-TargetVersion", targetVersion,
        "-ReadyPath", readyPath,
      ]
    : [updaterPath, ...commonArguments];
  return new Promise((resolve, reject) => {
    const launchLog = fs.openSync(launchLogPath, "a");
    let child;
    try {
      child = spawn(command, argumentsList, {
        detached: true,
        stdio: ["ignore", launchLog, launchLog],
        windowsHide: true,
      });
    } catch (error) {
      fs.closeSync(launchLog);
      reject(error);
      return;
    }
    fs.closeSync(launchLog);
    let settled = false;
    let pollTimer = null;
    let timeoutTimer = null;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (error) {
        if (child.exitCode === null && !child.killed) child.kill();
        reject(error);
      }
      else {
        fs.rmSync(readyPath, { force: true });
        child.unref();
        resolve();
      }
    };
    child.once("error", (error) => finish(error));
    child.once("exit", (code) => finish(new Error(`更新程序提前退出（代码 ${code ?? "未知"}）`)));
    pollTimer = setInterval(() => {
      if (fs.existsSync(readyPath)) finish();
    }, 50);
    timeoutTimer = setTimeout(() => {
      finish(new Error("等待更新程序响应超时"));
    }, 15_000);
  });
}

fs.mkdirSync(installRoot, { recursive: true });
let shutdownRequested = false;
let assistantSyncRunning = false;
const updateService = new UpdateService({
  currentVersion: APP_VERSION,
  platform: process.platform,
  installRoot,
  updaterPath,
  launchUpdater,
  requestShutdown: () => {
    shutdownRequested = true;
    setTimeout(shutdown, 350);
  },
});
const server = http.createServer(createRequestHandler({
  profilePath,
  siteRoot: path.join(projectRoot, "site"),
  adminRoot: path.join(projectRoot, "admin"),
  draftRoot: path.join(projectRoot, "assets", "admin-drafts"),
  appVersion: APP_VERSION,
  updateService,
}));

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") process.exit(0);
  console.error(`月海助手启动失败：${error.message}`);
  process.exit(1);
});

server.listen(MANAGER_PORT, "127.0.0.1", () => {
  fs.writeFileSync(pidPath, String(process.pid), "utf8");
  console.log(`月海助手已启动：http://127.0.0.1:${MANAGER_PORT}`);
});

async function syncAssistantUpdate() {
  if (assistantSyncRunning || shutdownRequested) return;
  assistantSyncRunning = true;
  try {
    const update = await updateService.getStatus();
    const exchange = await exchangeAssistantUpdate(profilePath, update);
    if (exchange?.command === "check") {
      const refreshedUpdate = await updateService.getStatus({ force: true });
      await exchangeAssistantUpdate(profilePath, refreshedUpdate);
    }
    if (exchange?.command === "download") await updateService.startDownload({ autoInstall: true });
    if (exchange?.command === "install") await updateService.startInstall();
  } catch {
    // Codex 可能还没有打开，下一轮会重新连接活动窗口。
  } finally {
    assistantSyncRunning = false;
  }
}

const assistantSyncTimer = setInterval(syncAssistantUpdate, 1_000);
assistantSyncTimer.unref();
void syncAssistantUpdate();

function shutdown() {
  clearInterval(assistantSyncTimer);
  server.close(() => {
    if (fs.existsSync(pidPath) && fs.readFileSync(pidPath, "utf8").trim() === String(process.pid)) {
      fs.rmSync(pidPath, { force: true });
    }
    process.exit(0);
  });
  if (shutdownRequested) {
    setTimeout(() => process.exit(0), 2_000).unref();
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
