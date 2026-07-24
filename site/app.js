const API_ROOT = "http://127.0.0.1:17321";
const DOWNLOADS = Object.freeze({
  windows: "https://github.com/413162826/moonsea-codex-theme/releases/latest/download/Moonsea-Codex-Windows-x64-Setup.exe",
  macos: "https://github.com/413162826/moonsea-codex-theme/releases/latest/download/Moonsea-Codex-macOS.zip",
});
const state = {
  connected: false,
  runtimeCapable: false,
  appVersion: null,
  catalogVersion: 0,
  activeThemeId: null,
  applyingThemeId: null,
  connecting: false,
  themes: [],
  filter: "all",
  query: "",
};

const elements = {
  connectionPill: document.querySelector("#connection-pill"),
  downloadLabel: document.querySelector("#download-label"),
  downloadLink: document.querySelector("#download-link"),
  filterButtons: [...document.querySelectorAll("[data-theme-filter]")],
  gallery: document.querySelector("#theme-gallery"),
  headerActions: document.querySelector(".header-actions"),
  query: document.querySelector("#theme-search"),
  receiptTitle: document.querySelector("#receipt-title"),
  result: document.querySelector("#result-message"),
  retry: document.querySelector("#retry-button"),
  standardMetric: document.querySelector("#standard-metric"),
  standardRendererMetric: document.querySelector("#standard-renderer-metric"),
  proMetric: document.querySelector("#pro-metric"),
  proRendererMetric: document.querySelector("#pro-renderer-metric"),
  statusDot: document.querySelector("#status-dot"),
  statusMessage: document.querySelector("#status-message"),
  statusTitle: document.querySelector("#status-title"),
  themeCount: document.querySelector("#theme-count"),
};

function configureAdminLink() {
  if (!["127.0.0.1", "localhost"].includes(window.location.hostname)) return;
  const link = document.createElement("a");
  link.className = "admin-link";
  link.href = "/admin/";
  link.textContent = "创作台";
  link.setAttribute("aria-label", "打开仅本机可用的主题创作台");
  elements.headerActions.prepend(link);
}

function updateCardActions() {
  for (const card of document.querySelectorAll(".theme-card")) {
    const theme = state.themes.find((item) => item.id === card.dataset.themeId);
    if (!theme) continue;
    const active = state.activeThemeId === theme.id;
    const applying = state.applyingThemeId === theme.id;
    const runtimeNeedsUpdate = !state.runtimeCapable;
    const action = card.querySelector("[data-theme-apply]");
    const activeLabel = card.querySelector("[data-theme-active]");
    card.classList.toggle("is-active", active);
    card.classList.toggle("is-applying", applying);
    card.setAttribute("aria-busy", String(applying));
    activeLabel.hidden = !active;
    action.disabled = !state.connected || runtimeNeedsUpdate || state.applyingThemeId !== null || active;
    action.classList.toggle("loading", applying);
    const isPro = theme.edition === "pro";
    action.textContent = applying
      ? "正在应用…"
      : active
        ? "当前壁纸"
        : runtimeNeedsUpdate
          ? "升级后应用"
          : state.connected
            ? isPro ? "应用 Pro" : "应用渐变"
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
  elements.downloadLabel.textContent = "支持 Windows / macOS";
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
  if (!response.ok) throw new Error("主题预览暂时没有准备好，请刷新页面重试");
  return response.json();
}

function setConnection(connected, message, runtimeCapable = false, appVersion = null) {
  state.connected = connected;
  state.runtimeCapable = runtimeCapable;
  state.appVersion = appVersion;
  const legacyAssistant = connected && !appVersion;
  elements.connectionPill.classList.toggle("is-connected", connected && !legacyAssistant);
  elements.connectionPill.classList.toggle("has-error", !connected || legacyAssistant);
  elements.statusDot.className = `status-dot ${connected && !legacyAssistant ? "connected" : "error"}`;
  elements.statusTitle.textContent = legacyAssistant
    ? "需要升级"
    : connected ? "Codex 已连接" : "Codex 未连接";
  elements.statusMessage.textContent = legacyAssistant
    ? "安装新版后即可应用壁纸"
    : connected ? "可直接应用渐变与 Pro 壁纸" : message;
  elements.retry.hidden = connected && !legacyAssistant;
  updateCardActions();
  if (legacyAssistant) {
    showResult("这是最后一次手动安装；升级后可直接在 Codex 的“月海助手”里更新。", "error");
  }
}

function showResult(message, kind = "") {
  elements.result.textContent = message;
  elements.result.className = `result-message ${kind}`.trim();
}

function matchesTheme(theme) {
  const categoryMatches = state.filter === "all"
    || (state.filter === "pro" && theme.edition === "pro")
    || (state.filter !== "pro" && theme.edition === "standard" && theme.mode === state.filter);
  if (!categoryMatches) return false;
  if (!state.query) return true;
  const searchText = [theme.name, theme.description, theme.mode, theme.edition].join(" ").toLocaleLowerCase("zh-CN");
  return searchText.includes(state.query);
}

function updateVisibleThemes() {
  let visibleCount = 0;
  for (const card of document.querySelectorAll(".theme-card")) {
    const theme = state.themes.find((item) => item.id === card.dataset.themeId);
    const visible = Boolean(theme && matchesTheme(theme));
    card.hidden = !visible;
    if (visible) visibleCount += 1;
  }
  const existingEmpty = elements.gallery.querySelector("[data-filter-empty]");
  existingEmpty?.remove();
  if (visibleCount === 0 && state.themes.length > 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.dataset.filterEmpty = "";
    empty.textContent = "没有找到匹配的主题，换个关键词或查看全部主题。";
    elements.gallery.append(empty);
  }
  elements.themeCount.textContent = visibleCount === state.themes.length
    ? `共 ${visibleCount} 个主题`
    : `找到 ${visibleCount} 个主题`;
}

function createStandardPreview(theme) {
  const windowFrame = document.createElement("div");
  windowFrame.className = "preview-window";
  windowFrame.setAttribute("aria-hidden", "true");
  windowFrame.style.setProperty("--mock-surface", theme.preview[0]);
  windowFrame.style.setProperty("--mock-surface-raised", theme.preview[1]);
  windowFrame.style.setProperty("--mock-accent", theme.preview[2]);
  windowFrame.style.setProperty("--mock-ink", theme.preview[3]);

  const titlebar = document.createElement("div");
  titlebar.className = "preview-window__titlebar";
  const appMark = document.createElement("span");
  appMark.className = "preview-window__mark";
  const appName = document.createElement("strong");
  appName.textContent = `Codex · ${theme.name}`;
  titlebar.append(appMark, appName);

  const shell = document.createElement("div");
  shell.className = "preview-window__shell";
  const sidebar = document.createElement("div");
  sidebar.className = "preview-window__sidebar";
  for (let index = 0; index < 4; index += 1) {
    const navItem = document.createElement("span");
    if (index === 0) navItem.classList.add("is-active");
    sidebar.append(navItem);
  }

  const workspace = document.createElement("div");
  workspace.className = "preview-window__workspace";
  const heading = document.createElement("b");
  heading.textContent = "Build a product people remember";
  const copy = document.createElement("div");
  copy.className = "preview-window__copy";
  copy.append(document.createElement("span"), document.createElement("span"));
  const code = document.createElement("div");
  code.className = "preview-window__code";
  code.append(document.createElement("span"), document.createElement("span"));
  const composer = document.createElement("div");
  composer.className = "preview-window__composer";
  const prompt = document.createElement("span");
  prompt.textContent = "Ask Codex anything…";
  const send = document.createElement("i");
  composer.append(prompt, send);
  workspace.append(heading, copy, code, composer);
  shell.append(sidebar, workspace);
  windowFrame.append(titlebar, shell);
  return windowFrame;
}

function createThemeCard(theme, index) {
  const card = document.createElement("article");
  card.className = `theme-card ${theme.edition === "pro" ? "pro-card" : ""}`;
  card.dataset.themeId = theme.id;
  card.style.setProperty("--pin-index", Math.min(index, 8));
  card.style.setProperty("--pin-ratio", "4 / 3");

  const preview = document.createElement("div");
  preview.className = `theme-preview ${theme.edition === "pro" ? "pro-preview" : "standard-preview"}`;
  preview.style.setProperty("--preview-gradient", theme.previewGradient);
  if (theme.edition === "standard") {
    preview.style.setProperty("--mock-accent", theme.preview[2]);
    preview.style.setProperty("--mock-ink", theme.preview[3]);
  }
  const type = document.createElement("span");
  type.className = "preview-badge";
  type.textContent = theme.edition === "pro"
    ? "精选 · Pro"
    : `渐变 · ${theme.mode === "dark" ? "深色" : "浅色"}`;
  const active = document.createElement("span");
  active.className = "active-badge";
  active.dataset.themeActive = "";
  active.textContent = "正在使用";
  active.hidden = true;
  preview.append(type, active);

  if (theme.edition === "pro") {
    const image = document.createElement("img");
    image.src = theme.previewImage;
    image.alt = `${theme.name}壁纸预览`;
    image.loading = "lazy";
    image.decoding = "async";
    preview.prepend(image);
  } else {
    preview.prepend(createStandardPreview(theme));
  }

  const footer = document.createElement("div");
  footer.className = "theme-card__footer";
  const copy = document.createElement("div");
  copy.className = "theme-copy";
  const name = document.createElement("h3");
  name.textContent = theme.name;
  const description = document.createElement("p");
  description.textContent = theme.description;
  copy.append(name, description);

  const apply = document.createElement("button");
  apply.className = "theme-card__apply";
  apply.type = "button";
  apply.dataset.themeApply = "";
  apply.setAttribute("aria-label", `应用${theme.name}壁纸到 Codex`);
  apply.textContent = "连接后应用";
  apply.disabled = true;
  apply.addEventListener("click", () => applyTheme(theme));

  footer.append(copy, apply);
  card.append(preview, footer);
  return card;
}

function orderThemes(themes) {
  const pro = themes.filter((theme) => theme.edition === "pro");
  const light = themes.filter((theme) => theme.edition === "standard" && theme.mode === "light");
  const dark = themes.filter((theme) => theme.edition === "standard" && theme.mode === "dark");
  const ordered = [...pro];
  for (let index = 0; index < Math.max(light.length, dark.length); index += 1) {
    if (light[index]) ordered.push(light[index]);
    if (dark[index]) ordered.push(dark[index]);
  }
  return ordered;
}

function renderThemes(themes) {
  state.themes = themes;
  const ordered = orderThemes(themes);
  elements.gallery.replaceChildren(...ordered.map(createThemeCard));
  updateCardActions();
  updateVisibleThemes();
}

async function ensureCatalog() {
  if (state.themes.length > 0) return;
  const catalog = await readCatalog();
  state.catalogVersion = catalog.catalogVersion ?? 0;
  renderThemes(catalog.themes);
}

async function connect() {
  if (state.connecting) return;
  state.connecting = true;
  elements.statusDot.className = "status-dot";
  elements.statusTitle.textContent = "正在连接";
  elements.statusMessage.textContent = "确认 Codex 是否已打开";
  try {
    await ensureCatalog();
    const status = await request("/api/status");
    setConnection(
      status.connected,
      status.message,
      status.runtimeCapable === true && status.catalogVersion >= 3,
      status.appVersion ?? null,
    );
    state.activeThemeId = state.themes.find((theme) => theme.id === status.themeId)?.id ?? null;
    updateCardActions();
  } catch (error) {
    setConnection(false, "打开月海版后会自动连接");
    if (state.themes.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = error.message;
      elements.gallery.replaceChildren(empty);
      elements.themeCount.textContent = "主题加载失败";
    }
  } finally {
    state.connecting = false;
  }
}

async function applyTheme(theme) {
  if (!theme || !state.connected || state.applyingThemeId !== null) return;
  if (!state.runtimeCapable) {
    showResult("渐变与 Pro 壁纸需要新版月海版，请先完成升级。", "error");
    return;
  }
  state.applyingThemeId = theme.id;
  updateCardActions();
  showResult(`正在把“${theme.name}”应用到 Codex…`);
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
    elements.receiptTitle.textContent = `“${theme.name}”已应用`;
    showResult(isPro
      ? `${theme.name}壁纸已应用，Codex 无需重启。`
      : `${theme.name}渐变壁纸已应用，Codex 无需重启。`, "success");
  } catch (error) {
    showResult(`${error.message}。请确认 Codex 月海版仍在运行。`, "error");
    await connect();
  } finally {
    state.applyingThemeId = null;
    updateCardActions();
  }
}

elements.retry.addEventListener("click", connect);
elements.query.addEventListener("input", (event) => {
  state.query = event.currentTarget.value.trim().toLocaleLowerCase("zh-CN");
  updateVisibleThemes();
});
for (const button of elements.filterButtons) {
  button.addEventListener("click", () => {
    state.filter = button.dataset.themeFilter;
    for (const item of elements.filterButtons) {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    }
    updateVisibleThemes();
  });
}

configureDownload();
configureAdminLink();
connect();
setInterval(connect, 5000);
