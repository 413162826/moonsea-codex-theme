const API_ROOT = "http://127.0.0.1:17321";
const DOWNLOADS = Object.freeze({
  windows: "https://github.com/413162826/moonsea-codex-theme/releases/latest/download/Moonsea-Codex-Windows-x64.zip",
  macos: "https://github.com/413162826/moonsea-codex-theme/releases/latest/download/Moonsea-Codex-macOS.zip",
});
const state = {
  connected: false,
  proCapable: false,
  appVersion: null,
  catalogVersion: 0,
  selected: null,
  activeThemeId: null,
  applyingThemeId: null,
  connecting: false,
  themes: [],
};

const elements = {
  downloadLabel: document.querySelector("#download-label"),
  downloadLink: document.querySelector("#download-link"),
  standardGrid: document.querySelector("#standard-theme-grid"),
  proGrid: document.querySelector("#pro-theme-grid"),
  result: document.querySelector("#result-message"),
  retry: document.querySelector("#retry-button"),
  standardMetric: document.querySelector("#standard-metric"),
  standardRendererMetric: document.querySelector("#standard-renderer-metric"),
  proMetric: document.querySelector("#pro-metric"),
  proRendererMetric: document.querySelector("#pro-renderer-metric"),
  statusDot: document.querySelector("#status-dot"),
  statusMessage: document.querySelector("#status-message"),
  statusTitle: document.querySelector("#status-title"),
};

function updateCardActions() {
  for (const card of document.querySelectorAll(".theme-card")) {
    const theme = state.themes.find((item) => item.id === card.dataset.themeId);
    if (!theme) continue;
    const selected = state.selected?.id === theme.id;
    const active = state.activeThemeId === theme.id;
    const applying = state.applyingThemeId === theme.id;
    const proNeedsUpdate = theme.edition === "pro" && !state.proCapable;
    const action = card.querySelector("[data-theme-apply]");
    const selector = card.querySelector("[data-theme-select]");
    card.classList.toggle("is-selected", selected);
    card.classList.toggle("is-active", active);
    selector.setAttribute("aria-pressed", String(selected));
    action.disabled = !state.connected || proNeedsUpdate || state.applyingThemeId !== null || active;
    action.classList.toggle("loading", applying);
    action.textContent = applying
      ? "正在应用…"
      : active
        ? "正在使用"
        : proNeedsUpdate
          ? "升级后应用"
          : state.connected
            ? "应用主题"
            : "连接后应用";
  }
}

function configureDownload() {
  const platform = [navigator.userAgentData?.platform, navigator.platform, navigator.userAgent]
    .filter(Boolean)
    .join(" ");
  const macos = /Mac/i.test(platform) && !/iPhone|iPad|iPod/i.test(platform);
  const windows = /Win/i.test(platform);
  if (macos) {
    elements.downloadLink.href = DOWNLOADS.macos;
    elements.downloadLabel.textContent = "下载 macOS 版";
    return;
  }
  if (windows) return;
  elements.downloadLink.removeAttribute("href");
  elements.downloadLink.removeAttribute("download");
  elements.downloadLabel.textContent = "仅支持 Windows / macOS";
  elements.downloadLink.setAttribute("aria-disabled", "true");
}

async function request(path, options) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error(body.error || "月海助手没有完成请求");
  return body;
}

async function readCatalog() {
  const response = await fetch("./catalog.json", { cache: "no-store" });
  if (!response.ok) throw new Error("主题目录没有准备好");
  return response.json();
}

function setConnection(connected, message, proCapable = false, appVersion = null) {
  state.connected = connected;
  state.proCapable = proCapable;
  state.appVersion = appVersion;
  elements.statusDot.className = `status-dot ${connected ? "connected" : "error"}`;
  const legacyAssistant = connected && !appVersion;
  elements.statusTitle.textContent = legacyAssistant
    ? "月海助手需要升级"
    : connected ? "Codex 已连接" : "还没有连接 Codex";
  elements.statusMessage.textContent = legacyAssistant
    ? "请下载新版并安装一次。登录、设置和自定义壁纸都会保留。"
    : message;
  const proNeedsUpdate = state.selected?.edition === "pro" && !proCapable;
  updateCardActions();
  if (connected && proNeedsUpdate) {
    elements.result.textContent = "Pro 主题需要新版月海版，请重新打开桌面的“Codex 月海版”。";
    elements.result.className = "result-message error";
  } else if (legacyAssistant) {
    elements.result.textContent = "这是最后一次手动安装；升级后可直接在 Codex 的“月海助手”里更新。";
    elements.result.className = "result-message error";
  }
}

function selectTheme(theme) {
  state.selected = theme;
  const proNeedsUpdate = theme.edition === "pro" && !state.proCapable;
  updateCardActions();
  elements.result.textContent = proNeedsUpdate
    ? "Pro 主题需要新版月海版，请重新打开桌面的“Codex 月海版”。"
    : "";
  elements.result.className = `result-message ${proNeedsUpdate ? "error" : ""}`.trim();
}

function createThemeCard(theme) {
  const card = document.createElement("article");
  card.className = `theme-card ${theme.edition === "pro" ? "pro-card" : ""}`;
  card.dataset.themeId = theme.id;

  const selector = document.createElement("button");
  selector.className = "theme-card__select";
  selector.type = "button";
  selector.dataset.themeSelect = "";
  selector.setAttribute("aria-pressed", "false");
  selector.setAttribute("aria-label", `预览${theme.name}主题，${theme.description}`);

  const preview = document.createElement("span");
  preview.className = `theme-preview ${theme.edition === "pro" ? "pro-preview" : "standard-preview"}`;
  preview.setAttribute("aria-hidden", "true");
  preview.style.setProperty("--preview-gradient", theme.previewGradient);
  if (theme.edition === "pro") {
    const image = document.createElement("img");
    image.src = theme.previewImage;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    preview.append(image);
  } else {
    for (const part of ["sidebar", "toolbar", "content", "composer"]) {
      const element = document.createElement("span");
      element.className = `preview-${part}`;
      preview.append(element);
    }
  }

  const copy = document.createElement("span");
  copy.className = "theme-copy";
  const name = document.createElement("strong");
  name.textContent = theme.name;
  const description = document.createElement("small");
  description.textContent = theme.description;
  copy.append(name, description);
  selector.append(preview, copy);

  const footer = document.createElement("div");
  footer.className = "theme-card__footer";
  const mode = document.createElement("span");
  mode.textContent = theme.edition === "pro" ? "Pro 沉浸主题" : theme.mode === "dark" ? "深色外观" : "浅色外观";
  const apply = document.createElement("button");
  apply.className = "theme-card__apply";
  apply.type = "button";
  apply.dataset.themeApply = "";
  apply.setAttribute("aria-label", `应用${theme.name}主题到 Codex`);
  apply.textContent = "连接后应用";
  apply.disabled = true;
  footer.append(mode, apply);
  card.append(selector, footer);
  selector.addEventListener("click", () => selectTheme(theme));
  apply.addEventListener("click", () => applyTheme(theme));
  return card;
}

function renderThemes(themes) {
  state.themes = themes;
  const standardThemes = themes
    .filter((theme) => theme.edition === "standard")
    .sort((left, right) => Number(left.mode === "dark") - Number(right.mode === "dark"));
  const proThemes = themes.filter((theme) => theme.edition === "pro");
  elements.standardGrid.replaceChildren(...standardThemes.map(createThemeCard));
  elements.proGrid.replaceChildren(...proThemes.map(createThemeCard));
  if (themes[0]) selectTheme(themes[0]);
}

async function connect() {
  if (state.connecting) return;
  state.connecting = true;
  elements.statusDot.className = "status-dot";
  elements.statusTitle.textContent = "正在连接月海助手";
  elements.statusMessage.textContent = "确认本机 Codex 是否已经就绪…";
  try {
    const [status, catalog] = await Promise.all([
      request("/api/status"),
      state.themes.length ? Promise.resolve(null) : readCatalog(),
    ]);
    if (catalog) {
      state.catalogVersion = catalog.catalogVersion ?? 0;
      renderThemes(catalog.themes);
    }
    setConnection(
      status.connected,
      status.message,
      status.proCapable === true && status.catalogVersion >= 2,
      status.appVersion ?? null,
    );
    const activeTheme = state.themes.find((theme) => theme.id === status.themeId);
    state.activeThemeId = activeTheme?.id ?? null;
    if (activeTheme) selectTheme(activeTheme);
    else updateCardActions();
  } catch (error) {
    setConnection(false, "请先下载并打开“Codex 月海版”，月海助手会自动启动。");
  } finally {
    state.connecting = false;
  }
}

async function applyTheme(theme) {
  if (!theme || !state.connected || state.applyingThemeId !== null) return;
  selectTheme(theme);
  if (theme.edition === "pro" && !state.proCapable) return;
  state.applyingThemeId = theme.id;
  updateCardActions();
  elements.result.textContent = "正在更新 Codex…";
  elements.result.className = "result-message";
  try {
    const { result } = await request("/api/themes/apply", {
      method: "POST",
      body: JSON.stringify({ themeId: theme.id }),
    });
    const isPro = theme.edition === "pro";
    const totalMetric = isPro ? elements.proMetric : elements.standardMetric;
    const rendererMetric = isPro ? elements.proRendererMetric : elements.standardRendererMetric;
    totalMetric.textContent = `${result.totalMs} ms`;
    rendererMetric.textContent = `Codex 窗口 ${result.rendererMs} ms`;
    state.activeThemeId = theme.id;
    elements.result.textContent = `${theme.name}已应用，Codex 无需重启。`;
  } catch (error) {
    elements.result.textContent = error.message;
    elements.result.className = "result-message error";
    await connect();
  } finally {
    state.applyingThemeId = null;
    updateCardActions();
  }
}

elements.retry.addEventListener("click", connect);
configureDownload();
connect();
setInterval(connect, 5000);
