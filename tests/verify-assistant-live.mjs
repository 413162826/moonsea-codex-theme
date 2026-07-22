import fs from "node:fs";
import path from "node:path";

const [profileInput, outputInput] = process.argv.slice(2);
if (!profileInput || !outputInput) {
  throw new Error("用法：node tests/verify-assistant-live.mjs <Profile> <截图目录>");
}
const profilePath = path.resolve(profileInput);
const outputPath = path.resolve(outputInput);
fs.mkdirSync(outputPath, { recursive: true });

async function waitFor(read, label, attempts = 120) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const value = await read();
      if (value) return value;
    } catch { }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`等待超时：${label}`);
}

const activePort = await waitFor(() => {
  const filePath = path.join(profilePath, "DevToolsActivePort");
  if (!fs.existsSync(filePath)) return null;
  const port = Number.parseInt(fs.readFileSync(filePath, "utf8").split(/\r?\n/)[0], 10);
  return Number.isInteger(port) ? port : null;
}, "Codex 调试端口");

const target = await waitFor(async () => {
  const response = await fetch(`http://127.0.0.1:${activePort}/json/list`);
  const targets = await response.json();
  return targets.find((item) => item.type === "page" && item.url === "app://-/index.html");
}, "Codex 主窗口");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let nextId = 1;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  const handler = pending.get(message.id);
  if (!handler) return;
  pending.delete(message.id);
  if (message.error) handler.reject(new Error(message.error.message));
  else handler.resolve(message.result);
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result?.value;
};
const capture = async (name) => {
  const result = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const filePath = path.join(outputPath, name);
  fs.writeFileSync(filePath, Buffer.from(result.data, "base64"));
  return filePath;
};

await call("Page.enable");
await waitFor(
  () => evaluate(`document.querySelector(".moonsea-controls__toggle")?.textContent?.includes("月海助手")`),
  "月海助手入口",
);
await evaluate(`(() => {
  const toggle = document.querySelector(".moonsea-controls__toggle");
  const panel = document.querySelector(".moonsea-controls__panel");
  if (!panel.hidden) toggle.click();
  toggle.click();
})()`);
await waitFor(
  () => evaluate(`document.querySelector("[data-update-message]")?.textContent?.includes("v9.0.0")`),
  "更新提示",
);
const standard = await evaluate(`(() => {
  const controls = document.querySelector("#codex-moonsea-controls");
  const panel = controls.querySelector(".moonsea-controls__panel");
  const pro = controls.querySelector("[data-pro-settings]");
  const toggle = controls.querySelector(".moonsea-controls__toggle");
  const style = getComputedStyle(panel);
  return {
    label: toggle.textContent.trim(),
    updateDot: toggle.classList.contains("is-update-available"),
    edition: controls.querySelector("[data-assistant-edition]").textContent,
    proHidden: pro.hidden,
    updateMessage: controls.querySelector("[data-update-message]").textContent,
    panelBackground: style.backgroundColor,
    panelColor: style.color,
    panelWidth: Math.round(panel.getBoundingClientRect().width),
  };
})()`);
const standardScreenshot = await capture("assistant-standard.png");
await evaluate(`document.querySelector("[data-update-action]").click()`);
await waitFor(
  () => evaluate(`document.querySelector("[data-update-message]")?.textContent?.includes("新版本已经准备好")`),
  "更新包下载与校验",
);
const downloadedUpdate = await evaluate(`(() => ({
  message: document.querySelector("[data-update-message]").textContent,
  action: document.querySelector("[data-update-action]").textContent,
}))()`);

await waitFor(async () => {
  const response = await fetch("http://127.0.0.1:17321/api/themes/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:17321" },
    body: JSON.stringify({ themeId: "tide-dragon-realm" }),
  });
  return response.ok;
}, "Pro 主题切换");
await waitFor(
  () => evaluate(`document.querySelector("[data-pro-settings]")?.hidden === false`),
  "Pro 设置",
);
const pro = await evaluate(`(() => ({
  edition: document.querySelector("[data-assistant-edition]").textContent,
  proHidden: document.querySelector("[data-pro-settings]").hidden,
  transparency: document.querySelector('[data-setting="transparency"]').value,
  wallpaper: document.querySelector("[data-wallpaper-status]").value,
}))()`);
const proScreenshot = await capture("assistant-pro.png");

await fetch("http://127.0.0.1:17321/api/themes/apply", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:17321" },
  body: JSON.stringify({ themeId: "moon-white" }),
});
await waitFor(
  () => evaluate(`document.querySelector("[data-pro-settings]")?.hidden === true`),
  "返回普通主题",
);

socket.close();
console.log(JSON.stringify({ standard, downloadedUpdate, pro, screenshots: [standardScreenshot, proScreenshot] }, null, 2));
