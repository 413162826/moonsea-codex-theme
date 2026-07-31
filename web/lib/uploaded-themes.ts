import baseCatalog from "../public/catalog.json";
import baseManifest from "../public/base-theme-catalog-v1.json";
import { createWallpaperPalette } from "./theme-palette";
import {
  isThemeUploadAuthorized,
  type ThemeUploadAuthConfig,
} from "./theme-upload-auth";

const THEME_ID = /^[a-z0-9-]+$/;
const HEX_COLOR = /^#[0-9A-F]{6}$/;
const POSITION = /^\d+% \d+%$/;
const MAX_IMAGE_SIZE = 12 * 1024 * 1024;
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

export type UploadedThemeRecord = {
  id: string;
  name: string;
  description: string;
  mode: "light" | "dark";
  previewGradient: string;
  runtime: {
    wallpaperName: string;
    wallpaperPosition: string;
    wallpaperGradient: string;
    palette: ReturnType<typeof createWallpaperPalette>;
    layout: "immersive";
    tier: "pro";
  };
};

type UploadedThemeRow = {
  id: string;
  themeJson: string;
  objectKey: string;
  contentType: string;
  sha256: string;
  size: number;
};

export type ThemeStorageEnv = {
  DB: D1Database;
  THEMES: R2Bucket;
};

export type ThemeUploadMetadata = {
  id: string;
  name: string;
  description: string;
  mode: "light" | "dark";
  accent: string;
  surface: string;
  ink: string;
  wallpaperPosition?: string;
};

export const BASE_THEME_IDS = new Set(
  (baseManifest.themes as Array<{ id: string }>).map(({ id }) => id),
);

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function parseMetadata(value: FormDataEntryValue | null): ThemeUploadMetadata {
  if (typeof value !== "string") throw new Error("metadata 必须是 JSON 字符串");
  let metadata: unknown;
  try {
    metadata = JSON.parse(value);
  } catch {
    throw new Error("metadata 不是合法 JSON");
  }
  if (!metadata || typeof metadata !== "object") {
    throw new Error("metadata 必须是 JSON 对象");
  }
  const candidate = metadata as Record<string, unknown>;
  const result = {
    id: String(candidate.id ?? ""),
    name: String(candidate.name ?? "").trim(),
    description: String(candidate.description ?? "").trim(),
    mode: candidate.mode,
    accent: String(candidate.accent ?? ""),
    surface: String(candidate.surface ?? ""),
    ink: String(candidate.ink ?? ""),
    wallpaperPosition: candidate.wallpaperPosition == null
      ? "50% 50%"
      : String(candidate.wallpaperPosition),
  };
  if (!THEME_ID.test(result.id)) throw new Error("主题 id 只能包含小写字母、数字和连字符");
  if (result.name.length < 2 || result.name.length > 24) throw new Error("主题名称长度应为 2 到 24 个字符");
  if (result.description.length < 8 || result.description.length > 100) {
    throw new Error("主题描述长度应为 8 到 100 个字符");
  }
  if (!["light", "dark"].includes(String(result.mode))) throw new Error("主题 mode 必须是 light 或 dark");
  for (const [key, color] of Object.entries({
    accent: result.accent,
    surface: result.surface,
    ink: result.ink,
  })) {
    if (!HEX_COLOR.test(color)) throw new Error(`${key} 必须是六位大写十六进制颜色`);
  }
  if (!POSITION.test(result.wallpaperPosition)) throw new Error("wallpaperPosition 格式应为“50% 50%”");
  return result as ThemeUploadMetadata;
}

function parsePng(bytes: Uint8Array) {
  if (
    bytes.length < 24
    || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)
  ) {
    throw new Error("wallpaper 必须是真实 PNG 图片");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width < 1600 || height < 900) throw new Error("壁纸分辨率不能低于 1600×900");
  const ratio = width / height;
  if (ratio < 1.7 || ratio > 1.84) throw new Error("壁纸必须接近 16:9 横屏比例");
  return { width, height };
}

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")).join("");
}

function buildUploadedTheme(metadata: ThemeUploadMetadata): UploadedThemeRecord {
  const dark = metadata.mode === "dark";
  return {
    id: metadata.id,
    name: metadata.name,
    description: metadata.description,
    mode: metadata.mode,
    previewGradient:
      `linear-gradient(135deg, ${metadata.surface}, ${metadata.accent})`,
    runtime: {
      wallpaperName: metadata.name,
      wallpaperPosition: metadata.wallpaperPosition ?? "50% 50%",
      wallpaperGradient:
        `linear-gradient(90deg, rgb(from ${metadata.surface} r g b / ${dark ? "0.52" : "0.32"}), rgb(from ${metadata.surface} r g b / 0.08) 48%, rgb(from ${metadata.surface} r g b / ${dark ? "0.24" : "0.14"}))`,
      palette: createWallpaperPalette(metadata),
      layout: "immersive",
      tier: "pro",
    },
  };
}

export async function listUploadedThemeRows(db: D1Database) {
  const rows = await db.prepare(`
    SELECT
      id,
      theme_json AS themeJson,
      object_key AS objectKey,
      content_type AS contentType,
      sha256,
      size
    FROM uploaded_themes
    ORDER BY created_at ASC, id ASC
  `).all<UploadedThemeRow>();
  return rows.results.map((row) => ({
    ...row,
    theme: JSON.parse(row.themeJson) as UploadedThemeRecord,
  }));
}

export async function listUploadedPublicThemes(db: D1Database) {
  return (await listUploadedThemeRows(db)).map(({ theme }) => ({
    id: theme.id,
    name: theme.name,
    description: theme.description,
    edition: "pro" as const,
    mode: theme.mode,
    previewImage: `/api/themes/assets/${theme.id}`,
    previewGradient: theme.previewGradient,
  }));
}

export async function createThemeManifest(request: Request, db: D1Database) {
  const uploaded = await listUploadedThemeRows(db);
  return {
    schemaVersion: 1,
    themes: [
      ...baseManifest.themes,
      ...uploaded.map(({ theme, contentType, sha256: digest, size }) => ({
        ...theme,
        edition: "pro",
        asset: {
          contentType,
          sha256: digest,
          size,
          url: new URL(`/api/themes/assets/${theme.id}`, request.url).toString(),
        },
      })),
    ],
  };
}

export async function handleThemeManifest(request: Request, db: D1Database) {
  return Response.json(await createThemeManifest(request, db), {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export async function handleThemeAsset(
  request: Request,
  env: ThemeStorageEnv,
  themeId: string,
) {
  if (!THEME_ID.test(themeId)) return new Response("Not Found", { status: 404 });
  const row = await env.DB.prepare(`
    SELECT object_key AS objectKey
    FROM uploaded_themes
    WHERE id = ?
  `).bind(themeId).first<{ objectKey: string }>();
  if (!row) return new Response("Not Found", { status: 404 });
  const object = await env.THEMES.get(row.objectKey);
  if (!object) return new Response("Not Found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}

export async function handleThemeUpload(
  request: Request,
  env: ThemeStorageEnv,
  auth: ThemeUploadAuthConfig,
) {
  if (!await isThemeUploadAuthorized(request, auth)) {
    return jsonResponse({ error: "需要月海管理员账号" }, 401);
  }
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return jsonResponse({ error: "请求必须使用 multipart/form-data" }, 415);
  }

  let metadata: ThemeUploadMetadata;
  let file: File;
  try {
    const form = await request.formData();
    metadata = parseMetadata(form.get("metadata"));
    const candidate = form.get("wallpaper");
    if (!(candidate instanceof File)) throw new Error("缺少 wallpaper 文件");
    file = candidate;
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "上传参数无效",
    }, 400);
  }

  if (BASE_THEME_IDS.has(metadata.id)) {
    return jsonResponse({ error: "主题 id 已存在" }, 409);
  }
  const existing = await env.DB.prepare(
    "SELECT id FROM uploaded_themes WHERE id = ?",
  ).bind(metadata.id).first();
  if (existing) return jsonResponse({ error: "主题 id 已存在" }, 409);
  if (file.type !== "image/png" || file.size < 1 || file.size > MAX_IMAGE_SIZE) {
    return jsonResponse({ error: "wallpaper 必须是 12MB 以内的 PNG 图片" }, 400);
  }

  let bytes: Uint8Array;
  let dimensions: { width: number; height: number };
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
    dimensions = parsePng(bytes);
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "图片无效",
    }, 400);
  }

  const digest = await sha256(bytes);
  const objectKey = `themes/${metadata.id}/${digest}.png`;
  const theme = buildUploadedTheme(metadata);
  await env.THEMES.put(objectKey, bytes, {
    httpMetadata: {
      contentType: "image/png",
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      themeId: metadata.id,
      sha256: digest,
      width: String(dimensions.width),
      height: String(dimensions.height),
    },
  });

  try {
    await env.DB.prepare(`
      INSERT INTO uploaded_themes (
        id,
        theme_json,
        object_key,
        content_type,
        sha256,
        size,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      metadata.id,
      JSON.stringify(theme),
      objectKey,
      "image/png",
      digest,
      bytes.length,
      new Date().toISOString(),
    ).run();
  } catch (error) {
    await env.THEMES.delete(objectKey);
    throw error;
  }

  return jsonResponse({
    ok: true,
    theme: {
      id: theme.id,
      name: theme.name,
      description: theme.description,
      edition: "pro",
      mode: theme.mode,
      previewImage: `/api/themes/assets/${theme.id}`,
      previewGradient: theme.previewGradient,
    },
    asset: {
      contentType: "image/png",
      sha256: digest,
      size: bytes.length,
      width: dimensions.width,
      height: dimensions.height,
      url: new URL(`/api/themes/assets/${theme.id}`, request.url).toString(),
    },
  }, 201);
}

export const BASE_PUBLIC_THEMES = baseCatalog.themes;
