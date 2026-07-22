import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { applyThemeToCodex, getCodexStatus, readDevToolsEndpoint } from "../src/manager-core.mjs";

const profilePath = path.resolve(process.argv[2] ?? "");
const outputRoot = path.resolve(process.argv[3] ?? path.join(process.cwd(), ".build", "live-qa"));
if (!process.argv[2]) throw new Error("请提供月海版 BrowserProfile 路径");
fs.mkdirSync(outputRoot, { recursive: true });

class Client {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
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
    this.socket.close();
  }
}

async function withPage(action) {
  const { port } = readDevToolsEndpoint(profilePath);
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  const target = targets.find((item) => item.type === "page" && item.url === "app://-/index.html")
    ?? targets.find((item) => item.type === "page" && /webview\/index\.html/.test(item.url ?? ""));
  if (!target?.webSocketDebuggerUrl) throw new Error("没有找到 Codex 主窗口");
  const client = new Client(target.webSocketDebuggerUrl);
  await client.connect();
  try {
    return await action(client);
  } finally {
    client.close();
  }
}

async function inspectAndCapture(name) {
  await new Promise((resolve) => setTimeout(resolve, 450));
  return withPage(async (client) => {
    const evaluation = await client.call("Runtime.evaluate", {
      expression: `(async () => ({
        proClass: document.documentElement.classList.contains("codex-moonsea"),
        controls: Boolean(document.querySelector("#codex-moonsea-controls")),
        ambient: Boolean(document.querySelector("#codex-moonsea-ambient")),
        runtimeStylesheet: Boolean(document.querySelector("#codex-moonsea-static-theme")),
        titlebarButtons: document.querySelectorAll(".draggable button[aria-label], [class*=\\"electron:h-toolbar\\"] button[aria-label]").length,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        wallpaperImage: document.documentElement.style.getPropertyValue("--moonsea-wallpaper-image"),
        wallpaperGradient: document.documentElement.style.getPropertyValue("--moonsea-wallpaper-gradient"),
        wallpaperPosition: document.documentElement.style.getPropertyValue("--moonsea-wallpaper-position"),
        wallpaperBackground: getComputedStyle(document.body, "::before").backgroundImage,
        wallpaperResource: document.documentElement.classList.contains("codex-moonsea")
          ? await fetch("./moonsea/wallpapers/tide-dragon-realm.png").then(async (response) => ({
              ok: response.ok,
              status: response.status,
              size: (await response.blob()).size
            })).catch((error) => ({ ok: false, error: error.message }))
          : null
      }))()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (evaluation.exceptionDetails) {
      throw new Error(
        evaluation.exceptionDetails.exception?.description
          ?? evaluation.exceptionDetails.text
          ?? "Codex 页面检查失败",
      );
    }
    const screenshot = await client.call("Page.captureScreenshot", {
      captureBeyondViewport: false,
      format: "png",
    });
    const screenshotPath = path.join(outputRoot, `${name}.png`);
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
    return { ...evaluation.result.value, screenshotPath };
  });
}

const results = [];
results.push({
  step: "standard-before",
  timing: await applyThemeToCodex(profilePath, "moon-white"),
  view: await inspectAndCapture("standard-before"),
});
results.push({
  step: "pro",
  timing: await applyThemeToCodex(profilePath, "tide-dragon-realm"),
  view: await inspectAndCapture("pro"),
});
results.push({
  step: "standard-after",
  timing: await applyThemeToCodex(profilePath, "moon-white"),
  view: await inspectAndCapture("standard-after"),
});

const status = await getCodexStatus(profilePath);
if (!results[1].view.proClass || !results[1].view.controls || !results[1].view.ambient) {
  throw new Error("Pro 运行时没有完整启用");
}
if (!results[1].view.wallpaperImage.includes("wallpapers/tide-dragon-realm.png") || !results[1].view.wallpaperGradient.includes("gradient(")) {
  throw new Error("Pro 壁纸目录或渐变层没有应用");
}
if (
  !results[1].view.wallpaperResource?.ok
  || results[1].view.wallpaperResource.size < 100_000
  || !results[1].view.wallpaperBackground.includes("app://-/moonsea/wallpapers/tide-dragon-realm.png")
  || results[1].view.wallpaperBackground.includes("/moonsea/moonsea/")
) {
  throw new Error(`Codex 没有成功读取 Pro 壁纸资源：${JSON.stringify({
    background: results[1].view.wallpaperBackground,
    resource: results[1].view.wallpaperResource,
  })}`);
}
if (results[2].view.proClass || results[2].view.controls || results[2].view.ambient || results[2].view.runtimeStylesheet) {
  throw new Error("切回普通主题后仍残留 Pro 运行时");
}
if (!status.connected || status.edition !== "standard" || status.proRuntimeActive) {
  throw new Error("最终 Codex 状态不是纯普通主题");
}

console.log(JSON.stringify({ results, status }, null, 2));
