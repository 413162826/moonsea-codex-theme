import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { STANDARD_THEMES, toPublicTheme } from "./theme-catalog.mjs";
import { PRO_THEMES, toPublicProTheme } from "./pro-theme-catalog.mjs";

export const MANAGER_PORT = 17321;
export const PUBLIC_SITE_ORIGIN = "https://413162826.github.io";

const LOCAL_ORIGINS = new Set([
  `http://127.0.0.1:${MANAGER_PORT}`,
  `http://localhost:${MANAGER_PORT}`,
]);

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
]);

export function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (LOCAL_ORIGINS.has(origin)) return true;
  return origin === PUBLIC_SITE_ORIGIN;
}

export function parseDevToolsActivePort(content) {
  const [portLine, socketPath] = String(content).trim().split(/\r?\n/);
  const port = Number.parseInt(portLine, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Codex 调试端口无效，请重新打开月海版");
  }
  return { port, socketPath: socketPath || null };
}

export function readDevToolsEndpoint(profilePath) {
  const activePortPath = path.join(profilePath, "DevToolsActivePort");
  if (!fs.existsSync(activePortPath)) {
    throw new Error("还没有连接到 Codex，请先打开“Codex 月海版”");
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
        reject(new Error("无法连接已打开的 Codex"));
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
        pending.reject(new Error("Codex 连接已关闭"));
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

async function findCodexTarget(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error("无法读取 Codex 窗口");
  const targets = await response.json();
  const pages = targets.filter((item) => item.type === "page");
  const target = pages.find((item) => item.url === "app://-/index.html")
    ?? pages.find((item) => /webview\/index\.html(?:$|[?#])/i.test(item.url ?? ""));
  if (!target?.webSocketDebuggerUrl) {
    throw new Error("没有找到可切换主题的 Codex 窗口");
  }
  return target;
}

async function withCodexClient(profilePath, action) {
  const { port } = readDevToolsEndpoint(profilePath);
  const target = await findCodexTarget(port);
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
      ?? "Codex 没有完成主题切换";
    throw new Error(message);
  }
  return result.result?.value;
}

export async function getCodexStatus(profilePath) {
  try {
    const value = await withCodexClient(profilePath, async (client) => {
      const result = await client.call("Runtime.evaluate", {
        expression: `(async () => {
          const bridgeInstalled = typeof window.moonseaThemeBridge?.applyStandardTheme === "function";
          const bridgeStatus = bridgeInstalled ? await window.moonseaThemeBridge.getStatus() : null;
          return {
            bridgeInstalled,
            bridgeReady: bridgeStatus?.ready === true,
            proCapable: typeof window.moonseaThemeBridge?.applyProTheme === "function",
            proRuntimeActive: bridgeStatus?.proActive === true,
            themeId: bridgeStatus?.themeId ?? null,
            restoreError: bridgeStatus?.restoreError ?? null,
            transparencyControlPresent: Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.trim() === "透明度")
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
          edition: value.proRuntimeActive ? "pro" : "standard",
          proCapable: value.proCapable,
          proRuntimeActive: value.proRuntimeActive,
          themeId: value.themeId,
          transparencyControlPresent: value.transparencyControlPresent,
          message: value.restoreError
            ? `Codex 已连接，外观恢复失败：${value.restoreError}`
            : "Codex 已连接",
        }
      : {
          connected: false,
          message: value?.bridgeInstalled
            ? "Codex 正在完成启动…"
            : "月海版需要更新后才能即时切换",
        };
  } catch (error) {
    return { connected: false, message: error.message };
  }
}

export async function applyThemeToCodex(profilePath, themeId) {
  const standardTheme = STANDARD_THEMES.find((theme) => theme.id === themeId);
  const theme = standardTheme ?? PRO_THEMES.find((item) => item.id === themeId);
  if (!theme) throw new Error(`没有这个主题：${themeId}`);
  const startedAt = performance.now();
  const bridgeResult = await withCodexClient(profilePath, async (client) => {
    const method = theme.edition === "pro" ? "applyProTheme" : "applyStandardTheme";
    const result = await client.call("Runtime.evaluate", {
      expression: `window.moonseaThemeBridge.${method}(${JSON.stringify(theme)})`,
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

export function createRequestHandler({ profilePath, siteRoot, status = getCodexStatus, apply = applyThemeToCodex }) {
  return async (request, response) => {
    const origin = request.headers.origin ?? "";
    const host = request.headers.host ?? "";
    if (!new Set([`127.0.0.1:${MANAGER_PORT}`, `localhost:${MANAGER_PORT}`]).has(host)) {
      sendJson(response, 403, { ok: false, error: "无效的访问地址" }, origin);
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

    const url = new URL(request.url, `http://${host}`);
    try {
      if (request.method === "GET" && url.pathname === "/api/status") {
        sendJson(response, 200, { ok: true, catalogVersion: 2, ...(await status(profilePath)) }, origin);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/themes") {
        sendJson(response, 200, {
          ok: true,
          catalogVersion: 2,
          themes: [
            ...STANDARD_THEMES.map(toPublicTheme),
            ...PRO_THEMES.map(toPublicProTheme),
          ],
          pro: { available: true },
        }, origin);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/themes/apply") {
        const { themeId } = await readJsonBody(request);
        const result = await apply(profilePath, themeId);
        sendJson(response, 200, { ok: true, result }, origin);
        return;
      }
      if (request.method === "GET" && serveStatic(response, siteRoot, url.pathname)) return;
      sendJson(response, 404, { ok: false, error: "页面不存在" }, origin);
    } catch (error) {
      sendJson(response, 400, { ok: false, error: error.message }, origin);
    }
  };
}
