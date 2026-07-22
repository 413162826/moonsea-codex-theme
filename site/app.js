const API_ROOT = "http://127.0.0.1:17321";
const state = { connected: false, selected: null, themes: [] };

const elements = {
  apply: document.querySelector("#apply-button"),
  grid: document.querySelector("#theme-grid"),
  result: document.querySelector("#result-message"),
  retry: document.querySelector("#retry-button"),
  selected: document.querySelector("#selected-theme"),
  standardMetric: document.querySelector("#standard-metric"),
  rendererMetric: document.querySelector("#renderer-metric"),
  statusDot: document.querySelector("#status-dot"),
  statusMessage: document.querySelector("#status-message"),
  statusTitle: document.querySelector("#status-title"),
};

async function request(path, options) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error(body.error || "月海助手没有完成请求");
  return body;
}

function setConnection(connected, message) {
  state.connected = connected;
  elements.statusDot.className = `status-dot ${connected ? "connected" : "error"}`;
  elements.statusTitle.textContent = connected ? "Codex 已连接" : "还没有连接 Codex";
  elements.statusMessage.textContent = message;
  elements.apply.disabled = !connected || !state.selected;
}

function selectTheme(theme) {
  state.selected = theme;
  elements.selected.textContent = theme.name;
  elements.apply.disabled = !state.connected;
  for (const card of elements.grid.querySelectorAll(".theme-card")) {
    card.setAttribute("aria-pressed", String(card.dataset.themeId === theme.id));
  }
  elements.result.textContent = "";
  elements.result.className = "result-message";
}

function renderThemes(themes) {
  state.themes = themes;
  elements.grid.replaceChildren(...themes.map((theme) => {
    const button = document.createElement("button");
    button.className = "theme-card";
    button.type = "button";
    button.dataset.themeId = theme.id;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", `选择${theme.name}主题，${theme.description}`);

    const preview = document.createElement("span");
    preview.className = "theme-preview";
    preview.setAttribute("aria-hidden", "true");
    for (const color of theme.preview.slice(0, 3)) {
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
  }));
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
    setConnection(status.connected, status.message);
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
    elements.standardMetric.textContent = `${result.totalMs} ms`;
    elements.rendererMetric.textContent = `Codex 窗口 ${result.rendererMs} ms`;
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
connect();
setInterval(connect, 5000);
