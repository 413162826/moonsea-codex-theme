import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_THEME_MANIFEST_URL =
  "https://moonsea-codex-theme.suguowen5.chatgpt.site/theme-catalog-v1.json";

const MAX_THEME_ASSET_SIZE = 12 * 1024 * 1024;
const THEME_ID = /^[a-z0-9-]+$/;
const SHA256 = /^[a-f0-9]{64}$/;
const CONTENT_TYPES = new Map([
  ["image/avif", "avif"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function assertHttpsUrl(value, label) {
  const url = new URL(value);
  const local = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) throw new Error(`${label}必须使用 HTTPS`);
  return url;
}

function validateRuntimeTheme(theme) {
  if (
    !theme
    || !THEME_ID.test(theme.id ?? "")
    || typeof theme.name !== "string"
    || !theme.name.trim()
    || !["standard", "pro"].includes(theme.edition)
    || !["light", "dark"].includes(theme.mode)
    || theme.runtime?.tier !== theme.edition
  ) {
    throw new Error("远程主题配置无效");
  }
  if (theme.runtime.palette?.scheme !== theme.mode) {
    throw new Error(`远程主题配色模式无效：${theme.id}`);
  }
  return theme;
}

function validateManifest(manifest, manifestUrl) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.themes)) {
    throw new Error("远程主题清单版本不受支持");
  }
  const seen = new Set();
  const themes = new Map();
  for (const candidate of manifest.themes) {
    const theme = validateRuntimeTheme(candidate);
    if (seen.has(theme.id)) throw new Error(`远程主题标识重复：${theme.id}`);
    seen.add(theme.id);
    if (theme.edition === "pro") {
      const asset = theme.asset;
      if (
        !asset
        || !CONTENT_TYPES.has(asset.contentType)
        || !SHA256.test(asset.sha256 ?? "")
        || !Number.isSafeInteger(asset.size)
        || asset.size < 1
        || asset.size > MAX_THEME_ASSET_SIZE
      ) {
        throw new Error(`远程壁纸资源无效：${theme.id}`);
      }
      const assetUrl = assertHttpsUrl(asset.url, "远程壁纸地址");
      if (assetUrl.origin !== manifestUrl.origin) {
        throw new Error(`远程壁纸必须来自月海主题站：${theme.id}`);
      }
      theme.asset = { ...asset, url: assetUrl.toString() };
    } else if (theme.asset != null) {
      throw new Error(`渐变主题不能携带图片资源：${theme.id}`);
    }
    themes.set(theme.id, theme);
  }
  return themes;
}

async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

export class ThemeDeliveryService {
  constructor({
    installRoot,
    manifestUrl = process.env.MOONSEA_THEME_MANIFEST_URL ?? DEFAULT_THEME_MANIFEST_URL,
    fetchImpl = globalThis.fetch,
  }) {
    this.cacheRoot = path.join(path.resolve(installRoot), "theme-cache");
    this.manifestUrl = assertHttpsUrl(manifestUrl, "远程主题清单地址");
    this.fetchImpl = fetchImpl;
    this.catalogPromise = null;
  }

  async loadCatalog({ force = false } = {}) {
    if (force) this.catalogPromise = null;
    this.catalogPromise ??= this.fetchImpl(this.manifestUrl.toString(), {
      headers: { Accept: "application/json" },
    }).then(async (response) => {
      if (!response.ok) throw new Error(`远程主题清单读取失败（HTTP ${response.status}）`);
      return validateManifest(await response.json(), this.manifestUrl);
    }).catch((error) => {
      this.catalogPromise = null;
      throw error;
    });
    return this.catalogPromise;
  }

  async resolve(themeId) {
    if (!THEME_ID.test(themeId ?? "")) throw new Error("主题标识无效");
    let catalog = await this.loadCatalog();
    let theme = catalog.get(themeId);
    if (!theme) {
      catalog = await this.loadCatalog({ force: true });
      theme = catalog.get(themeId);
    }
    if (!theme) throw new Error(`没有这个主题：${themeId}`);
    const resolved = structuredClone(theme);
    delete resolved.asset;
    if (theme.edition !== "pro") return resolved;

    const assetPath = await this.ensureAsset(theme.asset);
    const bytes = fs.readFileSync(assetPath);
    resolved.runtime.wallpaperAssetId = theme.id;
    resolved.runtime.wallpaperDataUrl = `data:${theme.asset.contentType};base64,${bytes.toString("base64")}`;
    return resolved;
  }

  async ensureAsset(asset) {
    fs.mkdirSync(this.cacheRoot, { recursive: true });
    const extension = CONTENT_TYPES.get(asset.contentType);
    const assetPath = path.join(this.cacheRoot, `${asset.sha256}.${extension}`);
    if (fs.existsSync(assetPath)) {
      const stat = fs.statSync(assetPath);
      if (stat.isFile() && stat.size === asset.size && await sha256File(assetPath) === asset.sha256) {
        return assetPath;
      }
      fs.rmSync(assetPath, { force: true });
    }

    const response = await this.fetchImpl(asset.url, {
      headers: { Accept: asset.contentType },
    });
    if (!response.ok) throw new Error(`远程壁纸下载失败（HTTP ${response.status}）`);
    const responseType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (responseType !== asset.contentType) throw new Error("远程壁纸格式与清单不一致");
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > 0 && contentLength !== asset.size) {
      throw new Error("远程壁纸大小与清单不一致");
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const digest = crypto.createHash("sha256").update(bytes).digest("hex");
    if (bytes.length !== asset.size || digest !== asset.sha256) {
      throw new Error("远程壁纸完整性校验失败");
    }
    const partialPath = `${assetPath}.${process.pid}.partial`;
    try {
      fs.writeFileSync(partialPath, bytes, { flag: "wx" });
      fs.renameSync(partialPath, assetPath);
    } finally {
      fs.rmSync(partialPath, { force: true });
    }
    return assetPath;
  }
}
