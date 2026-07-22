const API_ROOT = "http://127.0.0.1:17321";
const DOWNLOADS = Object.freeze({
  windows: "https://github.com/413162826/moonsea-codex-theme/releases/latest/download/Moonsea-Codex-Windows-x64.zip",
  macos: "https://github.com/413162826/moonsea-codex-theme/releases/latest/download/Moonsea-Codex-macOS.zip",
});
const state = { connected: false, proCapable: false, selected: null, themes: [] };

const elements = {
  apply: document.querySelector("#apply-button"),
  downloadLabel: document.querySelector("#download-label"),
  downloadLink: document.querySelector("#download-link"),
  standardGrid: document.querySelector("#standard-theme-grid"),
  proGrid: document.querySelector("#pro-theme-grid"),
  result: document.querySelector("#result-message"),
  retry: document.querySelector("#retry-button"),
  selected: document.querySelector("#selected-theme"),
  standardMetric: document.querySelector("#standard-metric"),
  standardRendererMetric: document.querySelector("#standard-renderer-metric"),
  proMetric: document.querySelector("#pro-metric"),
  proRendererMetric: document.querySelector("#pro-renderer-metric"),
  statusDot: document.querySelector("#status-dot"),
  statusMessage: document.querySelector("#status-message"),
  statusTitle: document.querySelector("#status-title"),
};

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

function setConnection(connected, message, proCapable = false) {
  state.connected = connected;
  state.proCapable = proCapable;
  elements.statusDot.className = `status-dot ${connected ? "connected" : "error"}`;
  elements.statusTitle.textContent = connected ? "Codex 已连接" : "还没有连接 Codex";
  elements.statusMessage.textContent = message;
  const proNeedsUpdate = state.selected?.edition === "pro" && !proCapable;
  elements.apply.disabled = !connected || !state.selected || proNeedsUpdate;
  if (connected && proNeedsUpdate) {
    elements.result.textContent = "Pro 主题需要新版月海版，请重新打开桌面的“Codex 月海版”。";
    elements.result.className = "result-message error";
  }
}

function selectTheme(theme) {
  state.selected = theme;
  elements.selected.textContent = theme.name;
  const proNeedsUpdate = theme.edition === "pro" && !state.proCapable;
  elements.apply.disabled = !state.connected || proNeedsUpdate;
  for (const card of document.querySelectorAll(".theme-card")) {
    card.setAttribute("aria-pressed", String(card.dataset.themeId === theme.id));
  }
  elements.result.textContent = proNeedsUpdate
    ? "Pro 主题需要新版月海版，请重新打开桌面的“Codex 月海版”。"
    : "";
  elements.result.className = `result-message ${proNeedsUpdate ? "error" : ""}`.trim();
}

function createThemeCard(theme) {
  const button = document.createElement("button");
  button.className = `theme-card ${theme.edition === "pro" ? "pro-card" : ""}`;
  button.type = "button";
  button.dataset.themeId = theme.id;
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-label", `选择${theme.name}主题，${theme.description}`);

  const preview = document.createElement("span");
  preview.className = "theme-preview";
  preview.setAttribute("aria-hidden", "true");
  for (const color of theme.preview.slice(0, 4)) {
    const swatch = document.createElement("span");
    swatch.style.background = color;
    preview.append(swatch);
  }

  const copy = document.createElement("span");
  copy.className = "theme-copy";
  const name = document.createElement("strong");
  name.textContent = theme.name;
  const description = document.createElement("small");
  description.textContent = theme.description;
  copy.append(name, description);
  button.append(preview, copy);
  button.addEventListener("click", () => selectTheme(theme));
  return button;
}

function renderThemes(themes) {
  state.themes = themes;
  const standardThemes = themes.filter((theme) => theme.edition === "standard");
  const proThemes = themes.filter((theme) => theme.edition === "pro");
  elements.standardGrid.replaceChildren(...standardThemes.map(createThemeCard));
  elements.proGrid.replaceChildren(...proThemes.map(createThemeCard));
  if (themes[0]) selectTheme(themes[0]);
}

async function connect() {
  elements.statusDot.className = "status-dot";
  elements.statusTitle.textContent = "正在连接月海助手";
  elements.statusMessage.textContent = "确认本机 Codex 是否已经就绪…";
  try {
    const [status, catalog] = await Promise.all([
      request("/api/status"),
      state.themes.length ? Promise.resolve(null) : request("/api/themes"),
    ]);
    if (catalog) renderThemes(catalog.themes);
    setConnection(status.connected, status.message, status.proCapable === true);
  } catch (error) {
    setConnection(false, "请先下载并打开“Codex 月海版”，月海助手会自动启动。");
  }
}

async function applySelectedTheme() {
  if (!state.selected || !state.connected) return;
  elements.apply.disabled = true;
  elements.apply.classList.add("loading");
  elements.result.textContent = "正在更新 Codex…";
  elements.result.className = "result-message";
  try {
    const { result } = await request("/api/themes/apply", {
      method: "POST",
      body: JSON.stringify({ themeId: state.selected.id }),
    });
    const isPro = state.selected.edition === "pro";
    const totalMetric = isPro ? elements.proMetric : elements.standardMetric;
    const rendererMetric = isPro ? elements.proRendererMetric : elements.standardRendererMetric;
    totalMetric.textContent = `${result.totalMs} ms`;
    rendererMetric.textContent = `Codex 窗口 ${result.rendererMs} ms`;
    elements.result.textContent = `${state.selected.name}已应用，Codex 无需重启。`;
  } catch (error) {
    elements.result.textContent = error.message;
    elements.result.className = "result-message error";
    await connect();
  } finally {
    elements.apply.classList.remove("loading");
    elements.apply.disabled = !state.connected || !state.selected;
  }
}

elements.retry.addEventListener("click", connect);
elements.apply.addEventListener("click", applySelectedTheme);
configureDownload();
connect();
setInterval(connect, 5000);
