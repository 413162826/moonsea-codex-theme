const RPC_MODULE_PATH = "__MOONSEA_RPC_MODULE_PATH__";
const APP_ACTION_EXPORT = "__MOONSEA_APP_ACTION_EXPORT__";
const THEME_VERSION = "__MOONSEA_THEME_VERSION__";

let appActionServicePromise;

function getAppActionService() {
  appActionServicePromise ??= import(RPC_MODULE_PATH).then((module) => {
    const service = module[APP_ACTION_EXPORT];
    if (!service || typeof service.run !== "function") {
      throw new Error("当前 Codex 版本没有可用的外观控制入口");
    }
    return service;
  });
  return appActionServicePromise;
}

function assertStandardTheme(theme) {
  if (!theme || theme.edition !== "standard") throw new Error("只支持普通主题");
  if (theme.mode !== "light" && theme.mode !== "dark") throw new Error("主题模式无效");
  if (theme.patch?.opaqueWindows !== true) throw new Error("普通主题必须保持窗口不透明");
}

function assertProTheme(theme) {
  if (!theme || theme.edition !== "pro") throw new Error("只支持 Pro 主题");
  if (theme.mode !== "light") throw new Error("Pro 主题必须使用官方浅色基底");
  if (theme.patch?.opaqueWindows !== true) throw new Error("Pro 基底必须保持窗口不透明");
}

async function ensureProRuntime() {
  if (window.moonseaProRuntime) return window.moonseaProRuntime;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "codex-moonsea-pro-runtime-script";
    script.src = `./moonsea/theme.js?v=${THEME_VERSION}`;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("Pro 主题运行时加载失败")), { once: true });
    document.body.appendChild(script);
  });
  if (!window.moonseaProRuntime) throw new Error("Pro 主题运行时没有完成初始化");
  return window.moonseaProRuntime;
}

function disableProRuntime() {
  return window.moonseaProRuntime?.disable() ?? { active: false };
}

async function applyStandardTheme(theme) {
  assertStandardTheme(theme);
  const startedAt = performance.now();
  disableProRuntime();
  const appActions = await getAppActionService();
  await appActions.run({
    action: { type: "app.appearance.set_mode", mode: theme.mode },
  });
  await appActions.run({
    action: {
      type: "app.appearance.set_theme",
      theme: { kind: "custom", patch: theme.patch },
      variant: theme.mode,
    },
  });
  return {
    themeId: theme.id,
    edition: "standard",
    rendererMs: Math.round((performance.now() - startedAt) * 10) / 10,
  };
}

async function applyProTheme(theme) {
  assertProTheme(theme);
  const startedAt = performance.now();
  const appActions = await getAppActionService();
  await appActions.run({
    action: { type: "app.appearance.set_mode", mode: "light" },
  });
  await appActions.run({
    action: {
      type: "app.appearance.set_theme",
      theme: { kind: "custom", patch: theme.patch },
      variant: "light",
    },
  });
  const runtime = await ensureProRuntime();
  await runtime.enable(theme.runtime);
  return {
    themeId: theme.id,
    edition: "pro",
    rendererMs: Math.round((performance.now() - startedAt) * 10) / 10,
  };
}

async function getStatus() {
  const appActions = await getAppActionService();
  return {
    ready: appActions.scope != null,
    proActive: window.moonseaProRuntime?.isActive() === true,
  };
}

Object.defineProperty(window, "moonseaThemeBridge", {
  configurable: false,
  enumerable: false,
  writable: false,
  value: Object.freeze({ applyProTheme, applyStandardTheme, getStatus }),
});
