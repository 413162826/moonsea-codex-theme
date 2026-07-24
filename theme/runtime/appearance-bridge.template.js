const RPC_MODULE_PATH = "__MOONSEA_RPC_MODULE_PATH__";
const APP_SERVICES_EXPORT = "__MOONSEA_APP_SERVICES_EXPORT__";
const THEME_VERSION = "__MOONSEA_THEME_VERSION__";
const APPEARANCE_STATE_KEY = "codex-moonsea-appearance-state-v1";

let appActionServicePromise;
let restoredAppearanceState = null;
let restoreError = null;
let restorationPromise = Promise.resolve();

function getAppActionService() {
  appActionServicePromise ??= import(RPC_MODULE_PATH).then((module) => {
    const services = module[APP_SERVICES_EXPORT];
    const service = services?.appActions;
    if (!service || typeof service.run !== "function") {
      throw new Error("当前 Codex 版本没有可用的外观控制入口");
    }
    return service;
  });
  return appActionServicePromise;
}

function assertRuntimeTheme(theme) {
  if (!theme || !["standard", "pro"].includes(theme.edition)) {
    throw new Error("壁纸业务类型无效");
  }
  if (!["light", "dark"].includes(theme.mode)) throw new Error("壁纸模式无效");
  if (!theme.runtime || typeof theme.runtime !== "object") {
    throw new Error("壁纸运行时配置无效");
  }
  if (theme.runtime.tier !== theme.edition) {
    throw new Error("壁纸业务类型与运行时不一致");
  }
}

function readAppearanceState() {
  const raw = localStorage.getItem(APPEARANCE_STATE_KEY);
  if (!raw) return null;
  const state = JSON.parse(raw);
  if (
    state?.schemaVersion !== 1
    || (state.edition !== "standard" && state.edition !== "pro")
    || typeof state.themeId !== "string"
    || !/^[a-z0-9-]+$/.test(state.themeId)
    || (state.runtime != null && typeof state.runtime !== "object")
    || (state.mode != null && !["light", "dark"].includes(state.mode))
  ) {
    throw new Error("已保存的月海外观状态无效");
  }
  return state;
}

function saveAppearanceState(theme) {
  const state = {
    schemaVersion: 1,
    edition: theme.edition,
    themeId: theme.id,
    mode: theme.mode,
    runtime: theme.runtime,
  };
  localStorage.setItem(APPEARANCE_STATE_KEY, JSON.stringify(state));
  restoredAppearanceState = state;
  restoreError = null;
}

async function ensureProRuntime() {
  if (window.moonseaProRuntime) return window.moonseaProRuntime;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "codex-moonsea-pro-runtime-script";
    script.src = `./moonsea/theme.js?v=${THEME_VERSION}`;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("月海壁纸运行时加载失败")), { once: true });
    document.body.appendChild(script);
  });
  if (!window.moonseaProRuntime) throw new Error("月海壁纸运行时没有完成初始化");
  return window.moonseaProRuntime;
}

async function applyRuntimeTheme(theme) {
  assertRuntimeTheme(theme);
  await restorationPromise;
  const startedAt = performance.now();
  const appActions = await getAppActionService();
  await appActions.run({
    action: { type: "app.appearance.set_mode", mode: theme.mode },
  });
  const runtime = await ensureProRuntime();
  await runtime.enable(theme.runtime, { selectTheme: true });
  saveAppearanceState(theme);
  return {
    themeId: theme.id,
    edition: theme.edition,
    rendererMs: Math.round((performance.now() - startedAt) * 10) / 10,
  };
}

async function getStatus() {
  await restorationPromise;
  const appActions = await getAppActionService();
  return {
    ready: true,
    runtimeActive: window.moonseaProRuntime?.isActive() === true,
    edition: restoredAppearanceState?.edition ?? null,
    themeId: restoredAppearanceState?.themeId ?? null,
    restoreError,
  };
}

async function restoreSavedAppearance() {
  const state = readAppearanceState();
  restoredAppearanceState = state;
  const runtime = await ensureProRuntime();
  if (state?.runtime) {
    await runtime.enable(state.runtime);
  } else {
    runtime.disable();
  }
}

Object.defineProperty(window, "moonseaThemeBridge", {
  configurable: false,
  enumerable: false,
  writable: false,
  value: Object.freeze({ applyRuntimeTheme, getStatus }),
});

restorationPromise = restoreSavedAppearance().catch((error) => {
  restoreError = error?.message || "月海外观恢复失败";
});
