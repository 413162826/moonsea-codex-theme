const MAX_IMAGE_SIZE = 40 * 1024 * 1024;
const STORAGE_KEY = "moonsea-admin-theme-draft-v1";
const DEFAULT_VALUES = Object.freeze({
  name: "未命名壁纸",
  id: "untitled-wallpaper",
  description: "等待完成视觉校准的管理员草稿",
  direction: "",
  ink: "#27332d",
  surface: "#f5efe2",
  sidebar: "#9fc7b0",
  accent: "#b34f3c",
  focalX: 50,
  focalY: 50,
  brightness: 94,
  surfaceOpacity: 78,
  sidebarOpacity: 82,
  protection: 24,
});
const DRAFT_TUNING = Object.freeze({
  "mint-academy": {
    sidebar: "#9FC7B0",
    direction: "降低壁纸装饰元素对左侧项目列表的干扰，保持贝壳白中部留白，下一轮重点检查窗口化尺寸。",
  },
  "vinyl-citrus": {
    sidebar: "#312D28",
    direction: "减少大面积纯黑压迫感，让芥末黄只承担选中态；正文中心继续保留安静的暖黑区域。",
  },
});

const elements = {
  artDirection: document.querySelector("#art-direction"),
  brightness: document.querySelector("#brightness"),
  canvas: document.querySelector("#cover-canvas"),
  codexPreview: document.querySelector("#codex-preview"),
  colorAccent: document.querySelector("#color-accent"),
  colorInk: document.querySelector("#color-ink"),
  colorSidebar: document.querySelector("#color-sidebar"),
  colorSurface: document.querySelector("#color-surface"),
  copyFeedback: document.querySelector("#copy-feedback"),
  copyPrompt: document.querySelector("#copy-prompt"),
  coverDescription: document.querySelector("#cover-description"),
  coverName: document.querySelector("#cover-name"),
  coverPreview: document.querySelector("#cover-preview"),
  draftLibrary: document.querySelector("#draft-library"),
  dropNote: document.querySelector("#drop-note"),
  dropTitle: document.querySelector("#drop-title"),
  dropZone: document.querySelector("#drop-zone"),
  exportCover: document.querySelector("#export-cover"),
  exportDraft: document.querySelector("#export-draft"),
  exportFeedback: document.querySelector("#export-feedback"),
  focalMeta: document.querySelector("#focal-meta"),
  focalX: document.querySelector("#focal-x"),
  focalY: document.querySelector("#focal-y"),
  imageInput: document.querySelector("#wallpaper-input"),
  imageMeta: document.querySelector("#image-meta"),
  protection: document.querySelector("#protection"),
  qualityList: document.querySelector("#quality-list"),
  qualityNote: document.querySelector("#quality-note"),
  qualityScore: document.querySelector("#quality-score"),
  resetDraft: document.querySelector("#reset-draft"),
  sidebarOpacity: document.querySelector("#sidebar-opacity"),
  surfaceOpacity: document.querySelector("#surface-opacity"),
  themeDescription: document.querySelector("#theme-description"),
  themeId: document.querySelector("#theme-id"),
  themeIdError: document.querySelector("#theme-id-error"),
  themeName: document.querySelector("#theme-name"),
};

const inputs = [
  elements.themeName,
  elements.themeId,
  elements.themeDescription,
  elements.artDirection,
  elements.colorInk,
  elements.colorSurface,
  elements.colorSidebar,
  elements.colorAccent,
  elements.focalX,
  elements.focalY,
  elements.brightness,
  elements.surfaceOpacity,
  elements.sidebarOpacity,
  elements.protection,
];

let activeImage = null;
let activeObjectUrl = "";
let activeImageLabel = "";
let activeDraftId = "";

function toUpperHex(value) {
  return value.toUpperCase();
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
}

function luminance(hex) {
  return hexToRgb(hex)
    .map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrastRatio(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function rgba(hex, alpha) {
  return `rgba(${hexToRgb(hex).join(", ")}, ${alpha})`;
}

function readValues() {
  return {
    name: elements.themeName.value.trim(),
    id: elements.themeId.value.trim(),
    description: elements.themeDescription.value.trim(),
    direction: elements.artDirection.value.trim(),
    ink: elements.colorInk.value,
    surface: elements.colorSurface.value,
    sidebar: elements.colorSidebar.value,
    accent: elements.colorAccent.value,
    focalX: Number(elements.focalX.value),
    focalY: Number(elements.focalY.value),
    brightness: Number(elements.brightness.value),
    surfaceOpacity: Number(elements.surfaceOpacity.value),
    sidebarOpacity: Number(elements.sidebarOpacity.value),
    protection: Number(elements.protection.value),
  };
}

function writeValues(values) {
  const merged = { ...DEFAULT_VALUES, ...values };
  elements.themeName.value = merged.name;
  elements.themeId.value = merged.id;
  elements.themeDescription.value = merged.description;
  elements.artDirection.value = merged.direction;
  elements.colorInk.value = merged.ink;
  elements.colorSurface.value = merged.surface;
  elements.colorSidebar.value = merged.sidebar;
  elements.colorAccent.value = merged.accent;
  elements.focalX.value = String(merged.focalX);
  elements.focalY.value = String(merged.focalY);
  elements.brightness.value = String(merged.brightness);
  elements.surfaceOpacity.value = String(merged.surfaceOpacity);
  elements.sidebarOpacity.value = String(merged.sidebarOpacity);
  elements.protection.value = String(merged.protection);
}

function readSavedValues() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function saveValues(values) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
}

function setCssVariables(values) {
  const root = document.documentElement;
  root.style.setProperty("--admin-focal-x", `${values.focalX}%`);
  root.style.setProperty("--admin-focal-y", `${values.focalY}%`);
  root.style.setProperty("--admin-brightness", (values.brightness / 100).toFixed(2));
  root.style.setProperty("--admin-surface", values.surface);
  root.style.setProperty("--admin-sidebar", values.sidebar);
  root.style.setProperty("--admin-ink", values.ink);
  root.style.setProperty("--admin-accent", values.accent);
  root.style.setProperty("--admin-surface-alpha", `${values.surfaceOpacity}%`);
  root.style.setProperty("--admin-sidebar-alpha", `${values.sidebarOpacity}%`);
  root.style.setProperty("--admin-protection-alpha", `${values.protection}%`);
}

function setRangeOutput(input) {
  document.querySelector(`output[for="${input.id}"]`).value = `${input.value}%`;
}

function setColorOutput(input) {
  document.querySelector(`output[for="${input.id}"]`).value = toUpperHex(input.value);
}

function validateIdentity(values) {
  const validId = /^[a-z0-9-]+$/.test(values.id);
  elements.themeId.setAttribute("aria-invalid", String(!validId));
  elements.themeIdError.textContent = validId ? "" : "仅使用小写字母、数字和连字符";
  return Boolean(values.name && values.description && validId);
}

function updateQuality(values) {
  const checks = {
    image: Boolean(activeImage),
    identity: validateIdentity(values),
    contrast: contrastRatio(values.ink, values.surface) >= 4.5,
    cover: Boolean(activeImage),
    direction: values.direction.length >= 20,
  };
  let score = 0;
  for (const [key, valid] of Object.entries(checks)) {
    elements.qualityList.querySelector(`[data-check="${key}"]`)?.classList.toggle("is-valid", valid);
    if (valid) score += 1;
  }
  elements.qualityScore.textContent = `${score} / 5`;
  const ratio = contrastRatio(values.ink, values.surface);
  elements.qualityNote.textContent = checks.contrast
    ? `正文与主表面对比度 ${ratio.toFixed(2)} : 1。草稿仍需人工检查复杂壁纸区域。`
    : `正文与主表面对比度只有 ${ratio.toFixed(2)} : 1，请先调整正文或主表面颜色。`;
  elements.exportDraft.disabled = !checks.image || !checks.identity;
  elements.exportCover.disabled = !checks.image;
}

function updatePreview({ persist = true } = {}) {
  const values = readValues();
  setCssVariables(values);
  for (const input of [
    elements.focalX,
    elements.focalY,
    elements.brightness,
    elements.surfaceOpacity,
    elements.sidebarOpacity,
    elements.protection,
  ]) {
    setRangeOutput(input);
  }
  for (const input of [
    elements.colorInk,
    elements.colorSurface,
    elements.colorSidebar,
    elements.colorAccent,
  ]) {
    setColorOutput(input);
  }
  elements.coverName.textContent = values.name || "未命名壁纸";
  elements.coverDescription.textContent = values.description || "还没有填写主题描述";
  elements.focalMeta.textContent = `焦点 ${values.focalX}% ${values.focalY}%`;
  updateQuality(values);
  if (persist) saveValues(values);
}

function releaseObjectUrl() {
  if (!activeObjectUrl) return;
  URL.revokeObjectURL(activeObjectUrl);
  activeObjectUrl = "";
}

async function loadImageSource(source, label, { objectUrl = false, draftId = "" } = {}) {
  const image = new Image();
  image.decoding = "async";
  await new Promise((resolve, reject) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", () => reject(new Error("图片无法读取，请换一张原图")), { once: true });
    image.src = source;
  });
  releaseObjectUrl();
  activeObjectUrl = objectUrl ? source : "";
  activeImage = image;
  activeImageLabel = label;
  activeDraftId = draftId;
  document.documentElement.style.setProperty("--admin-wallpaper", `url("${source}")`);
  elements.dropTitle.textContent = label;
  elements.dropNote.textContent = `${image.naturalWidth} × ${image.naturalHeight}`;
  elements.imageMeta.textContent = `${label} · ${image.naturalWidth} × ${image.naturalHeight}`;
  updatePreview();
}

async function handleFile(file) {
  if (!file) return;
  if (!["image/png", "image/jpeg", "image/webp", "image/avif"].includes(file.type)) {
    throw new Error("只支持 PNG、JPEG、WebP 或 AVIF");
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("图片不能超过 40 MB");
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    await loadImageSource(objectUrl, file.name, { objectUrl: true });
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function showSourceError(message) {
  elements.dropTitle.textContent = "导入失败";
  elements.dropNote.textContent = message;
}

async function loadDraftLibrary() {
  try {
    const response = await fetch("/api/admin/drafts", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "管理员样稿读取失败");
    const buttons = result.drafts.map((draft) => {
      const button = document.createElement("button");
      button.className = "draft-sample";
      button.type = "button";
      const image = document.createElement("img");
      image.src = draft.image;
      image.alt = "";
      const label = document.createElement("span");
      label.textContent = draft.name;
      button.append(image, label);
      button.addEventListener("click", async () => {
        const tuning = DRAFT_TUNING[draft.id] ?? {};
        const [focalX = "50", focalY = "50"] = draft.focalPoint.split(" ");
        writeValues({
          ...readValues(),
          name: draft.name,
          id: draft.id,
          description: draft.description,
          ink: draft.palette.ink,
          surface: draft.palette.surface,
          accent: draft.palette.accent,
          sidebar: tuning.sidebar ?? draft.palette.surface,
          direction: tuning.direction ?? "",
          focalX: Number.parseInt(focalX, 10),
          focalY: Number.parseInt(focalY, 10),
        });
        try {
          await loadImageSource(draft.image, `${draft.name} · 管理员样稿`, { draftId: draft.id });
        } catch (error) {
          showSourceError(error.message);
        }
      });
      return button;
    });
    elements.draftLibrary.replaceChildren(...buttons);
  } catch (error) {
    const message = document.createElement("p");
    message.textContent = error.message;
    elements.draftLibrary.replaceChildren(message);
  }
}

function setFocalPoint(event) {
  const bounds = elements.codexPreview.getBoundingClientRect();
  const x = Math.round(Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * 100);
  const y = Math.round(Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) * 100);
  elements.focalX.value = String(x);
  elements.focalY.value = String(y);
  updatePreview();
}

function buildPrompt(values) {
  const direction = values.direction || "请先形成清晰的构图主次，并为桌面界面预留安静区域。";
  return [
    `创作一张原创 16:9 桌面壁纸，主题暂定为“${values.name || "未命名壁纸"}”。`,
    direction,
    `配色以 ${toUpperHex(values.surface)} 为主表面基调，${toUpperHex(values.sidebar)} 为辅助色，${toUpperHex(values.accent)} 只作少量强调，深色结构使用 ${toUpperHex(values.ink)}。`,
    `视觉焦点位于画面 ${values.focalX}% ${values.focalY}%，必须同时适配 16:9 桌面背景与 4:3 封面裁切。`,
    "画面中部保留足够安静的阅读空间，避免高频纹理、文字、品牌标志、UI 截图、发光渐变和廉价 3D 元素。",
  ].join("\n");
}

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(buildPrompt(readValues()));
    elements.copyFeedback.textContent = "已复制";
  } catch {
    elements.copyFeedback.textContent = "浏览器没有允许复制";
  }
  window.setTimeout(() => {
    elements.copyFeedback.textContent = "";
  }, 1800);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportDraft() {
  const values = readValues();
  const draft = {
    schemaVersion: 1,
    status: "draft",
    id: values.id,
    name: values.name,
    description: values.description,
    source: {
      file: activeImageLabel,
      draftId: activeDraftId || null,
      width: activeImage?.naturalWidth ?? null,
      height: activeImage?.naturalHeight ?? null,
    },
    artDirection: values.direction,
    previewPosition: `${values.focalX}% ${values.focalY}%`,
    wallpaperPosition: `${values.focalX}% ${values.focalY}%`,
    tuning: {
      brightness: values.brightness,
      surfaceOpacity: values.surfaceOpacity,
      sidebarOpacity: values.sidebarOpacity,
      protection: values.protection,
    },
    palette: {
      ink: toUpperHex(values.ink),
      surface: toUpperHex(values.surface),
      sidebar: toUpperHex(values.sidebar),
      accent: toUpperHex(values.accent),
    },
    quality: {
      textContrast: Number(contrastRatio(values.ink, values.surface).toFixed(2)),
      coverAndRuntimeShareFocalPoint: true,
    },
  };
  downloadBlob(
    new Blob([`${JSON.stringify(draft, null, 2)}\n`], { type: "application/json" }),
    `${values.id || "moonsea-theme-draft"}.json`,
  );
  elements.exportFeedback.textContent = "草稿已导出";
}

function drawCoverImage(context, image, width, height, focalX, focalY) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const overflowX = Math.max(0, drawWidth - width);
  const overflowY = Math.max(0, drawHeight - height);
  const drawX = -overflowX * (focalX / 100);
  const drawY = -overflowY * (focalY / 100);
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

async function exportCover() {
  if (!activeImage) return;
  const values = readValues();
  const context = elements.canvas.getContext("2d");
  const { width, height } = elements.canvas;
  context.clearRect(0, 0, width, height);
  context.filter = `brightness(${values.brightness}%)`;
  drawCoverImage(context, activeImage, width, height, values.focalX, values.focalY);
  context.filter = "none";
  const protection = values.protection / 100;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, rgba(values.surface, protection * 0.52));
  gradient.addColorStop(0.48, rgba(values.surface, 0));
  gradient.addColorStop(1, rgba(values.ink, protection * 0.48));
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  const blob = await new Promise((resolve) => elements.canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("封面导出失败");
  downloadBlob(blob, `${values.id || "moonsea-cover"}-cover.png`);
  elements.exportFeedback.textContent = "封面已导出";
}

function resetTuning() {
  const current = readValues();
  writeValues({
    ...DEFAULT_VALUES,
    name: current.name,
    id: current.id,
    description: current.description,
    direction: current.direction,
  });
  updatePreview();
  elements.exportFeedback.textContent = "参数已恢复";
}

for (const input of inputs) {
  input.addEventListener("input", () => updatePreview());
  input.addEventListener("blur", () => updatePreview());
}

elements.imageInput.addEventListener("change", async () => {
  const file = elements.imageInput.files?.[0];
  elements.imageInput.value = "";
  try {
    await handleFile(file);
  } catch (error) {
    showSourceError(error.message);
  }
});

for (const type of ["dragenter", "dragover"]) {
  elements.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("is-dragging");
  });
}

for (const type of ["dragleave", "drop"]) {
  elements.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("is-dragging");
  });
}

elements.dropZone.addEventListener("drop", async (event) => {
  try {
    await handleFile(event.dataTransfer?.files?.[0]);
  } catch (error) {
    showSourceError(error.message);
  }
});

elements.codexPreview.addEventListener("pointerdown", (event) => {
  elements.codexPreview.setPointerCapture(event.pointerId);
  setFocalPoint(event);
});
elements.codexPreview.addEventListener("pointermove", (event) => {
  if (elements.codexPreview.hasPointerCapture(event.pointerId)) setFocalPoint(event);
});
elements.codexPreview.addEventListener("keydown", (event) => {
  const deltas = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const delta = deltas[event.key];
  if (!delta) return;
  event.preventDefault();
  const step = event.shiftKey ? 5 : 1;
  elements.focalX.value = String(Math.max(0, Math.min(100, Number(elements.focalX.value) + delta[0] * step)));
  elements.focalY.value = String(Math.max(0, Math.min(100, Number(elements.focalY.value) + delta[1] * step)));
  updatePreview();
});

elements.copyPrompt.addEventListener("click", copyPrompt);
elements.exportDraft.addEventListener("click", exportDraft);
elements.exportCover.addEventListener("click", () => {
  exportCover().catch((error) => {
    elements.exportFeedback.textContent = error.message;
  });
});
elements.resetDraft.addEventListener("click", resetTuning);
window.addEventListener("beforeunload", releaseObjectUrl);

writeValues(readSavedValues() ?? DEFAULT_VALUES);
updatePreview({ persist: false });
loadDraftLibrary();
