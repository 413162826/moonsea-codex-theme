import fs from "node:fs";
import path from "node:path";

const [profileInput, outputInput] = process.argv.slice(2);
if (!profileInput || !outputInput) {
  throw new Error("用法：node tests/verify-motion-live.mjs <Profile> <截图目录>");
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
    await new Promise((resolve) => setTimeout(resolve, 100));
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
const runtimeErrors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (message.method === "Runtime.exceptionThrown") {
    runtimeErrors.push(
      message.params?.exceptionDetails?.exception?.description
      ?? message.params?.exceptionDetails?.text
      ?? "未知运行时异常",
    );
    return;
  }
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
  const result = await call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result?.value;
};

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const capture = async (name) => {
  const result = await call("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  const filePath = path.join(outputPath, name);
  fs.writeFileSync(filePath, Buffer.from(result.data, "base64"));
  return filePath;
};

const changeControl = (selector, value, eventName = "change") =>
  evaluate(`(() => {
    const control = document.querySelector(${JSON.stringify(selector)});
    if (!control) return false;
    ${typeof value === "boolean" ? `control.checked = ${value};` : `control.value = ${JSON.stringify(value)};`}
    control.dispatchEvent(new Event(${JSON.stringify(eventName)}, { bubbles: true }));
    return true;
  })()`);

await call("Page.enable");
await call("Runtime.enable");
await call("Page.bringToFront");
await call("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
});
await waitFor(
  () => evaluate(`Boolean(window.moonseaProRuntime)`),
  "Pro 运行时入口",
);
await delay(1_000);
const boot = await evaluate(`(async () => {
  try {
    await window.moonseaProRuntime.enable();
    return {
      active: true,
      error: null,
      canvasPresent: Boolean(document.querySelector("#codex-moonsea-motion-layer")),
      rootClass: document.documentElement.className,
    };
  } catch (error) {
    return { active: false, error: error?.stack || error?.message || String(error) };
  }
})()`);
if (!boot.active) throw new Error(`Pro 自动启动失败：${boot.error}`);
await delay(250);
const postBoot = await evaluate(`(() => ({
  active: window.moonseaProRuntime.isActive(),
  rootClass: document.documentElement.className,
  canvasPresent: Boolean(document.querySelector("#codex-moonsea-motion-layer")),
  canvasCount: document.querySelectorAll("#codex-moonsea-motion-layer").length,
  controlsPresent: Boolean(document.querySelector("#codex-moonsea-controls")),
  bodyChildren: [...document.body.children].map((element) => ({
    tag: element.tagName,
    id: element.id,
  })),
}))()`);
if (!postBoot.canvasPresent) {
  throw new Error(`月潮特效层未创建：${JSON.stringify({ boot, postBoot })}`);
}
await evaluate(`(() => {
  const panel = document.querySelector(".moonsea-controls__panel");
  if (panel?.hidden) document.querySelector(".moonsea-controls__toggle")?.click();
})()`);
await changeControl('[data-setting="effectsEnabled"]', true);
await waitFor(
  () => evaluate(`document.documentElement.classList.contains("moonsea-motion-soft")`),
  "交互特效基线",
);

const initial = await evaluate(`(() => {
  const layer = document.querySelector("#codex-moonsea-motion-layer");
  const canvas = layer.querySelector("canvas");
  const root = document.documentElement;
  return {
    effectsEnabled: document.querySelector('[data-setting="effectsEnabled"]').checked,
    effectsDisabled: document.querySelector('[data-setting="effectsEnabled"]').disabled,
    canvasPointerEvents: getComputedStyle(layer).pointerEvents,
    canvasWidth: canvas.width,
    viewportWidth: innerWidth,
    documentHidden: document.hidden,
    rootClass: root.className,
    note: document.querySelector("[data-motion-note]").textContent,
  };
})()`);

await call("Input.dispatchMouseEvent", {
  type: "mouseMoved",
  x: 90,
  y: 120,
});
await delay(220);
const moved = await evaluate(`(() => ({
  x: document.documentElement.style.getPropertyValue("--moonsea-motion-x"),
  y: document.documentElement.style.getPropertyValue("--moonsea-motion-y"),
}))()`);

await changeControl('[data-setting="effectsEnabled"]', false);
await waitFor(
  () => evaluate(`document.querySelector("#codex-moonsea-motion-layer")?.hidden === true`),
  "关闭全部动效",
);

const disabledControls = await evaluate(`(() => ({
  canvasHidden: document.querySelector("#codex-moonsea-motion-layer")?.hidden,
  checked: document.querySelector('[data-setting="effectsEnabled"]')?.checked,
  reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  stored: localStorage.getItem("codex-moonsea-theme-settings-v2"),
}))()`);
await changeControl('[data-setting="effectsEnabled"]', true);
await waitFor(
  () => evaluate(`document.querySelector("#codex-moonsea-motion-layer")?.hidden === false`),
  "重新开启全部动效",
);
await evaluate(`(() => {
  window.__moonseaMotionTestClick = null;
  document.addEventListener("click", (event) => {
    window.__moonseaMotionTestClick = {
      detail: event.detail,
      x: event.clientX,
      y: event.clientY,
      target: event.target?.tagName || null,
    };
  }, { capture: true, once: true });
})()`);
await call("Input.dispatchMouseEvent", {
  type: "mousePressed",
  x: 280,
  y: 260,
  button: "left",
  clickCount: 1,
});
await call("Input.dispatchMouseEvent", {
  type: "mouseReleased",
  x: 280,
  y: 260,
  button: "left",
  clickCount: 1,
});
await delay(90);
const ripplePixels = await evaluate(`(() => {
  const canvas = document.querySelector("#codex-moonsea-motion-layer canvas");
  const context = canvas.getContext("2d");
  const ratio = canvas.width / innerWidth;
  const sample = context.getImageData(
    Math.max(0, Math.round((280 - 74) * ratio)),
    Math.max(0, Math.round((260 - 74) * ratio)),
    Math.round(148 * ratio),
    Math.round(148 * ratio),
  ).data;
  let visible = 0;
  for (let index = 3; index < sample.length; index += 4) {
    if (sample[index] > 0) visible += 1;
  }
  return visible;
})()`);
const dispatchedClick = await evaluate(`window.__moonseaMotionTestClick`);

await call("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-reduced-motion", value: "reduce" }],
});
await waitFor(
  () => evaluate(`document.querySelector("#codex-moonsea-motion-layer")?.hidden === true`),
  "减少动态效果",
);
const reduced = await evaluate(`(() => ({
  canvasHidden: document.querySelector("#codex-moonsea-motion-layer").hidden,
  motionClass: document.documentElement.classList.contains("moonsea-motion-soft"),
  controlChecked: document.querySelector('[data-setting="effectsEnabled"]').checked,
  controlDisabled: document.querySelector('[data-setting="effectsEnabled"]').disabled,
  overrideControlPresent: Boolean(document.querySelector('[data-setting="motionOverrideReduced"]')),
  note: document.querySelector("[data-motion-note]").textContent,
}))()`);

await call("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
});
await waitFor(
  () => evaluate(`document.documentElement.classList.contains("moonsea-motion-soft")
    && document.querySelector('[data-setting="effectsEnabled"]').disabled === false`),
  "恢复动态效果",
);

const screenshot = await capture("motion-assistant-pro.png");

await evaluate(`window.moonseaProRuntime.disable()`);
await waitFor(
  () => evaluate(`!document.querySelector("#codex-moonsea-motion-layer")`),
  "退出 Pro 后清理特效层",
);
const disabled = await evaluate(`(() => ({
  canvasPresent: Boolean(document.querySelector("#codex-moonsea-motion-layer")),
  motionClass: document.documentElement.classList.contains("moonsea-motion-soft"),
  x: document.documentElement.style.getPropertyValue("--moonsea-motion-x"),
  y: document.documentElement.style.getPropertyValue("--moonsea-motion-y"),
}))()`);

socket.close();

if (!initial.effectsEnabled || initial.effectsDisabled) throw new Error("默认交互特效未启用");
if (initial.canvasPointerEvents !== "none") throw new Error("特效层拦截了鼠标");
if (initial.canvasWidth > initial.viewportWidth * 1.5 + 1) throw new Error("特效层像素比超过 1.5");
if (!moved.x || !moved.y || moved.x === "0.00px" || moved.y === "0.00px") {
  throw new Error("鼠标移动没有驱动壁纸视差");
}
if (ripplePixels <= 0) {
  throw new Error(`点击月晕没有绘制可见像素：${JSON.stringify({
    initial,
    disabledControls,
    dispatchedClick,
    runtimeErrors,
  })}`);
}
if (
  !reduced.canvasHidden
  || reduced.motionClass
  || reduced.controlChecked
  || !reduced.controlDisabled
  || reduced.overrideControlPresent
  || !reduced.note.includes("跟随系统关闭")
) {
  throw new Error(`减少动态效果没有完整生效：${JSON.stringify(reduced)}`);
}
if (disabled.canvasPresent || disabled.motionClass || disabled.x || disabled.y) {
  throw new Error("退出 Pro 后仍有特效残留");
}

console.log(JSON.stringify({
  initial,
  moved,
  ripplePixels,
  disabledControls,
  reduced,
  disabled,
  screenshot,
}, null, 2));
