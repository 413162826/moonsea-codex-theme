import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { STANDARD_THEMES, toPublicTheme } from "./theme-catalog.mjs";
import { PRO_THEMES, toPublicProTheme } from "./pro-theme-catalog.mjs";
import { WALLPAPER_DRAFTS } from "./wallpaper-catalog.mjs";

export const MANAGER_PORT = Number.parseInt(process.env.MOONSEA_MANAGER_PORT ?? "17321", 10);
if (!Number.isInteger(MANAGER_PORT) || MANAGER_PORT < 1 || MANAGER_PORT > 65535) {
  throw new Error("月海助手端口无效");
}
export const PUBLIC_SITE_ORIGIN = "https://moonsea-codex-theme.suguowen5.chatgpt.site";

// 客户端身份：codex（默认）或 workbuddy。WorkBuddy 通过环境变量注入，
// 其官方应用包名、调试端口与主题桥名由对应安装包/启动脚本提供。
export const CLIENT = (process.env.MOONSEA_CLIENT ?? "codex").toLowerCase();
if (!["codex", "workbuddy"].includes(CLIENT)) {
  throw new Error(`不支持的月海客户端：${CLIENT}`);
}
export const CLIENT_LABEL = process.env.MOONSEA_CLIENT_LABEL ?? (CLIENT === "workbuddy" ? "WorkBuddy" : "Codex");
export const THEME_BRIDGE = "window.moonseaThemeBridge";

const LOCAL_ORIGINS = new Set([
  `http://127.0.0.1:${MANAGER_PORT}`,
  `http://localhost:${MANAGER_PORT}`,
  "app://-",
]);

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

export function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (LOCAL_ORIGINS.has(origin)) return true;
  return origin === PUBLIC_SITE_ORIGIN;
}

export function isLocalAdminOrigin(origin) {
  return !origin || LOCAL_ORIGINS.has(origin);
}

export function parseDevToolsActivePort(content) {
  const [portLine, socketPath] = String(content).trim().split(/\r?\n/);
  const port = Number.parseInt(portLine, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${CLIENT_LABEL} 调试端口无效，请重新打开月海版`);
  }
  return { port, socketPath: socketPath || null };
}

export function readDevToolsEndpoint(profilePath) {
  const activePortPath = path.join(profilePath, "DevToolsActivePort");
  if (!fs.existsSync(activePortPath)) {
    throw new Error(`还没有连接到 ${CLIENT_LABEL}，请先打开“${CLIENT_LABEL} 月海版”`);
  }
  return parseDevToolsActivePort(fs.readFileSync(activePortPath, "utf8"));
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.webSocketUrl);
    await new Promise((resolve, reject) => {
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("无法连接已打开的客户端"));
      };
      const cleanup = () => {
        this.socket.removeEventListener("open", onOpen);
        this.socket.removeEventListener("error", onError);
      };
      this.socket.addEventListener("open", onOpen);
      this.socket.addEventListener("error", onError);
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
    this.socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) {
        pending.reject(new Error("客户端连接已关闭"));
      }
      this.pending.clear();
    });
  }

  call(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket?.close();
  }
}

export function getClientTargetConfig(client = CLIENT) {
  if (client === "workbuddy") {
    return {
      url: null,
      pattern: /\/renderer\/index\.html(?:$|[?#])/i,
    };
  }
  if (client === "codex") {
    return {
      url: "app://-/index.html",
      pattern: /\/webview\/index\.html(?:$|[?#])/i,
    };
  }
  throw new Error(`不支持的月海客户端：${client}`);
}

async function findClientTarget(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`无法读取 ${CLIENT_LABEL} 窗口`);
  const targets = await response.json();
  const pages = targets.filter((item) => item.type === "page");
  const targetConfig = getClientTargetConfig();
  const target = (
    targetConfig.url
      ? pages.find((item) => item.url === targetConfig.url)
      : null
  ) ?? pages.find((item) => targetConfig.pattern.test(item.url ?? ""));
  if (!target?.webSocketDebuggerUrl) {
    throw new Error(`没有找到可切换主题的 ${CLIENT_LABEL} 窗口`);
  }
  return target;
}

async function withClientTarget(profilePath, action) {
  const { port } = readDevToolsEndpoint(profilePath);
  const target = await findClientTarget(port);
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  try {
    return await action(client);
  } finally {
    client.close();
  }
}

function readEvaluationResult(result) {
  if (result.exceptionDetails) {
    const message = result.exceptionDetails.exception?.description
      ?? result.exceptionDetails.text
      ?? `${CLIENT_LABEL} 没有完成主题切换`;
    throw new Error(message);
  }
  return result.result?.value;
}

export async function getCodexStatus(profilePath) {
  try {
    const value = await withClientTarget(profilePath, async (client) => {
      const result = await client.call("Runtime.evaluate", {
        expression: `(async () => {
          const bridgeInstalled = typeof ${THEME_BRIDGE}?.applyRuntimeTheme === "function";
          const bridgeStatus = bridgeInstalled ? await ${THEME_BRIDGE}.getStatus() : null;
          return {
            bridgeInstalled,
            bridgeReady: bridgeStatus?.ready === true,
            runtimeCapable: typeof ${THEME_BRIDGE}?.applyRuntimeTheme === "function",
            runtimeActive: bridgeStatus?.runtimeActive === true,
            edition: bridgeStatus?.edition ?? null,
            themeId: bridgeStatus?.themeId ?? null,
            restoreError: bridgeStatus?.restoreError ?? null,
            assistantPresent: Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.trim() === "月海助手")
          };
        })()`,
        awaitPromise: true,
        returnByValue: true,
      });
      return readEvaluationResult(result);
    });
    return value?.bridgeReady
      ? {
          connected: true,
          edition: value.edition,
          runtimeCapable: value.runtimeCapable,
          runtimeActive: value.runtimeActive,
          themeId: value.themeId,
          assistantPresent: value.assistantPresent,
          message: value.restoreError
            ? `${CLIENT_LABEL} 已连接，外观恢复失败：${value.restoreError}`
            : `${CLIENT_LABEL} 已连接`,
        }
      : {
          connected: false,
          message: value?.bridgeInstalled
            ? `${CLIENT_LABEL} 正在完成启动…`
            : "月海版需要更新后才能即时切换",
        };
  } catch (error) {
    return { connected: false, message: error.message };
  }
}

function resolveBundledTheme(themeId) {
  const standardTheme = STANDARD_THEMES.find((theme) => theme.id === themeId);
  const theme = standardTheme ?? PRO_THEMES.find((item) => item.id === themeId);
  if (!theme) throw new Error(`没有这个主题：${themeId}`);
  return theme;
}

export async function applyThemeToCodex(profilePath, theme) {
  const startedAt = performance.now();
  const bridgeResult = await withClientTarget(profilePath, async (client) => {
    const result = await client.call("Runtime.evaluate", {
      expression: `${THEME_BRIDGE}.applyRuntimeTheme(${JSON.stringify(theme)})`,
      awaitPromise: true,
      returnByValue: true,
    });
    return readEvaluationResult(result);
  });
  return {
    ...bridgeResult,
    totalMs: Math.round((performance.now() - startedAt) * 10) / 10,
  };
}

export async function exchangeAssistantUpdate(profilePath, update) {
  return withClientTarget(profilePath, async (client) => {
    const result = await client.call("Runtime.evaluate", {
      expression: `(() => {
        const bridge = window.moonseaAssistantUpdateBridge;
        if (!bridge) return { ready: false, command: null };
        const command = bridge.takeCommand();
        if (!command) bridge.setStatus(${JSON.stringify(update)});
        return {
          ready: true,
          command,
        };
      })()`,
      returnByValue: true,
    });
    return readEvaluationResult(result);
  });
}

function sendJson(response, statusCode, body, origin) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": origin || `http://127.0.0.1:${MANAGER_PORT}`,
    "Access-Control-Allow-Private-Network": "true",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32 * 1024) throw new Error("请求内容过大");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function serveStatic(response, siteRoot, pathname) {
  const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const filePath = path.resolve(siteRoot, relative);
  const safeRoot = path.resolve(siteRoot) + path.sep;
  if (!filePath.startsWith(safeRoot) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }
  response.writeHead(200, {
    "Cache-Control": "no-cache",
    "Content-Type": MIME_TYPES.get(path.extname(filePath)) ?? "application/octet-stream",
  });
  response.end(fs.readFileSync(filePath));
  return true;
}

function serveMountedStatic(response, root, pathname, mountPath) {
  if (!root || (pathname !== mountPath && !pathname.startsWith(`${mountPath}/`))) {
    return false;
  }
  if (pathname === mountPath) {
    response.writeHead(308, {
      "Cache-Control": "no-store",
      Location: `${mountPath}/`,
    });
    response.end();
    return true;
  }
  const relative = decodeURIComponent(pathname.slice(mountPath.length)).replace(/^\/+/, "")
    || "index.html";
  const filePath = path.resolve(root, relative);
  const safeRoot = path.resolve(root) + path.sep;
  if (!filePath.startsWith(safeRoot) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": MIME_TYPES.get(path.extname(filePath)) ?? "application/octet-stream",
  });
  response.end(fs.readFileSync(filePath));
  return true;
}

export function createRequestHandler({
  profilePath,
  siteRoot,
  adminRoot = null,
  draftRoot = null,
  appVersion = "0.0.0",
  adminAccess = false,
  updateService = null,
  status = getCodexStatus,
  apply = applyThemeToCodex,
  resolveTheme = null,
  themeDeliveryVersion = resolveTheme ? 1 : 0,
}) {
  return async (request, response) => {
    const origin = request.headers.origin ?? "";
    const host = request.headers.host ?? "";
    if (!new Set([`127.0.0.1:${MANAGER_PORT}`, `localhost:${MANAGER_PORT}`]).has(host)) {
      sendJson(response, 403, { ok: false, error: "无效的访问地址" }, origin);
      return;
    }
    const url = new URL(request.url, `http://${host}`);
    const adminRequest = url.pathname === "/admin"
      || url.pathname.startsWith("/admin/")
      || url.pathname.startsWith("/api/admin/")
      || url.pathname.startsWith("/drafts/");
    if (adminRequest && !isLocalAdminOrigin(origin)) {
      sendJson(response, 403, { ok: false, error: "管理员创作台只允许本机访问" }, origin);
      return;
    }
    if (!isAllowedOrigin(origin)) {
      sendJson(response, 403, { ok: false, error: "这个网页不能控制月海主题" }, origin);
      return;
    }
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Private-Network": "true",
        Vary: "Origin",
      });
      response.end();
      return;
    }

    try {
      if (request.method === "GET" && url.pathname === "/api/status") {
        sendJson(response, 200, {
          ok: true,
          appVersion,
          adminAccess,
          catalogVersion: 3,
          themeDeliveryVersion,
          ...(await status(profilePath)),
        }, origin);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/themes") {
        sendJson(response, 200, {
          ok: true,
          catalogVersion: 3,
          themes: [
            ...STANDARD_THEMES.map(toPublicTheme),
            ...PRO_THEMES.map(toPublicProTheme),
          ],
          tiers: {
            standard: { available: true, kind: "gradient" },
            pro: { available: true, kind: "image" },
          },
        }, origin);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/admin/drafts") {
        sendJson(response, 200, {
          ok: true,
          drafts: WALLPAPER_DRAFTS.map((draft) => ({
            id: draft.id,
            name: draft.name,
            description: draft.description,
            image: `/drafts/${draft.file}`,
            scheme: draft.palette.scheme,
            focalPoint: draft.wallpaperPosition,
            palette: {
              ink: draft.patch.ink,
              surface: draft.patch.surface,
              accent: draft.patch.accent,
            },
          })),
        }, origin);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/themes/apply") {
        const { themeId } = await readJsonBody(request);
        const theme = await (resolveTheme ?? resolveBundledTheme)(themeId);
        const result = await apply(profilePath, theme);
        sendJson(response, 200, { ok: true, result }, origin);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/update/status") {
        if (!updateService) throw new Error("当前安装不支持应用内更新");
        sendJson(response, 200, { ok: true, update: await updateService.getStatus() }, origin);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/update/download") {
        if (!updateService) throw new Error("当前安装不支持应用内更新");
        sendJson(response, 202, { ok: true, update: await updateService.startDownload() }, origin);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/update/install") {
        if (!updateService) throw new Error("当前安装不支持应用内更新");
        sendJson(response, 202, { ok: true, update: await updateService.startInstall() }, origin);
        return;
      }
      if (request.method === "GET" && serveMountedStatic(response, adminRoot, url.pathname, "/admin")) return;
      if (request.method === "GET" && serveMountedStatic(response, draftRoot, url.pathname, "/drafts")) return;
      if (request.method === "GET" && serveStatic(response, siteRoot, url.pathname)) return;
      sendJson(response, 404, { ok: false, error: "页面不存在" }, origin);
    } catch (error) {
      sendJson(response, 400, { ok: false, error: error.message }, origin);
    }
  };
}
