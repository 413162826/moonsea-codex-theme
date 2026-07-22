const RPC_MODULE_PATH = "__MOONSEA_RPC_MODULE_PATH__";
const APP_ACTION_EXPORT = "__MOONSEA_APP_ACTION_EXPORT__";

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

function assertTheme(theme) {
  if (!theme || theme.edition !== "standard") throw new Error("只支持普通主题");
  if (theme.mode !== "light" && theme.mode !== "dark") throw new Error("主题模式无效");
  if (theme.patch?.opaqueWindows !== true) throw new Error("普通主题必须保持窗口不透明");
}

async function applyStandardTheme(theme) {
  assertTheme(theme);
  const startedAt = performance.now();
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

async function getStatus() {
  const appActions = await getAppActionService();
  return { ready: appActions.scope != null };
}

Object.defineProperty(window, "moonseaThemeBridge", {
  configurable: false,
  enumerable: false,
  writable: false,
  value: Object.freeze({ applyStandardTheme, getStatus }),
});
