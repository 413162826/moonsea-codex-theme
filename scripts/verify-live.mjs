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
        runtimeClass: document.documentElement.classList.contains("codex-moonsea"),
        controls: Boolean(document.querySelector("#codex-moonsea-controls")),
        assistantLabel: document.querySelector(".moonsea-controls__toggle")?.textContent?.trim() ?? null,
        assistantEdition: document.querySelector("[data-assistant-edition]")?.textContent?.trim() ?? null,
        wallpaperSettingsHidden: document.querySelector("[data-wallpaper-settings]")?.hidden ?? null,
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
  step: "standard-light",
  timing: await applyThemeToCodex(profilePath, "moon-white"),
  view: await inspectAndCapture("standard-light"),
});
results.push({
  step: "standard-dark",
  timing: await applyThemeToCodex(profilePath, "deep-sea"),
  view: await inspectAndCapture("standard-dark"),
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
if (!results[0].view.runtimeClass || !results[0].view.controls || results[0].view.ambient) {
  throw new Error("普通渐变壁纸运行时没有完整启用");
}
if (
  results[0].view.assistantEdition !== "渐变壁纸"
  || results[0].view.wallpaperSettingsHidden !== false
) {
  throw new Error("普通渐变壁纸没有获得完整助手设置");
}
for (const result of results.slice(0, 2)) {
  if (
    !result.view.wallpaperImage.includes("gradient(")
    || result.view.wallpaperImage.includes("url(")
    || !result.view.wallpaperGradient.includes("transparent")
  ) {
    throw new Error(`${result.step} 没有应用官网同源渐变`);
  }
}
if (results[0].view.wallpaperImage === results[1].view.wallpaperImage) {
  throw new Error("明暗普通壁纸没有切换实际渐变");
}
if (!results[2].view.runtimeClass || !results[2].view.controls || results[2].view.ambient) {
  throw new Error("Pro 运行时没有完整启用");
}
if (
  results[2].view.assistantEdition !== "Pro 壁纸"
  || results[2].view.wallpaperSettingsHidden !== false
) {
  throw new Error("Pro 壁纸助手业务标识无效");
}
if (!results[2].view.wallpaperImage.includes("wallpapers/tide-dragon-realm.png") || !results[2].view.wallpaperGradient.includes("gradient(")) {
  throw new Error("Pro 壁纸目录或渐变层没有应用");
}
if (
  !results[2].view.wallpaperResource?.ok
  || results[2].view.wallpaperResource.size < 100_000
  || !results[2].view.wallpaperBackground.includes("app://-/moonsea/wallpapers/tide-dragon-realm.png")
  || results[2].view.wallpaperBackground.includes("/moonsea/moonsea/")
) {
  throw new Error(`Codex 没有成功读取 Pro 壁纸资源：${JSON.stringify({
    background: results[2].view.wallpaperBackground,
    resource: results[2].view.wallpaperResource,
  })}`);
}
if (
  !results[3].view.runtimeClass
  || !results[3].view.controls
  || !results[3].view.runtimeStylesheet
  || !results[3].view.wallpaperImage.includes("gradient(")
  || results[3].view.wallpaperImage.includes("url(")
) {
  throw new Error("切回普通主题后没有恢复渐变壁纸运行时");
}
if (!status.connected || status.edition !== "standard" || !status.runtimeActive) {
  throw new Error("最终 Codex 状态不是普通渐变壁纸");
}

console.log(JSON.stringify({ results, status }, null, 2));
