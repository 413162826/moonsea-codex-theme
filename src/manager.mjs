import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createRequestHandler, MANAGER_PORT } from "./manager-core.mjs";

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

fs.mkdirSync(installRoot, { recursive: true });
const server = http.createServer(createRequestHandler({
  profilePath,
  siteRoot: path.join(projectRoot, "site"),
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

function shutdown() {
  server.close(() => {
    if (fs.existsSync(pidPath) && fs.readFileSync(pidPath, "utf8").trim() === String(process.pid)) {
      fs.rmSync(pidPath, { force: true });
    }
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
