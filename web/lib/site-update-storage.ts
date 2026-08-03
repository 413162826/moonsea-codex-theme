import type { SiteUpdate, SiteUpdateImage, UpdateCategory } from "./site-updates";
import {
  isThemeUploadAuthorized,
  type ThemeUploadAuthConfig,
} from "./theme-upload-auth";

const UPDATE_ID = /^[a-z0-9][a-z0-9-]{2,79}$/;
const THEME_ID = /^[a-z0-9-]+$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const KINDS = new Set<SiteUpdate["kind"]>(["站点更新", "版本", "壁纸上新"]);
const CATEGORIES = new Set<UpdateCategory>(["新功能", "体验优化", "修复"]);

type SiteUpdateRow = {
  id: string;
  date: string;
  displayDate: string;
  kind: SiteUpdate["kind"];
  category: UpdateCategory;
  version: string;
  title: string;
  summary: string;
  detailsJson: string;
  imagesJson: string;
  releaseUrl: string | null;
  current: number;
  createdAt: string;
};

type UploadedThemeRow = {
  id: string;
  themeJson: string;
  objectKey: string;
};

export type SiteUpdateUploadPayload = {
  id: string;
  date: string;
  displayDate: string;
  kind: SiteUpdate["kind"];
  category?: UpdateCategory;
  version: string;
  title: string;
  summary: string;
  details: string[];
  current?: boolean;
  releaseUrl?: string;
  themeIds?: string[];
};

type UpdateStorageEnv = {
  DB: D1Database;
  THEMES: R2Bucket;
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求参数无效";
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !DATE.test(value)) {
    throw new Error("date 必须是 YYYY-MM-DD 格式");
  }
  const match = DATE.exec(value);
  if (!match) throw new Error("date 必须是 YYYY-MM-DD 格式");
  const [, year, month, day] = match;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    parsed.getUTCFullYear() !== Number(year)
    || parsed.getUTCMonth() + 1 !== Number(month)
    || parsed.getUTCDate() !== Number(day)
  ) {
    throw new Error("date 不是有效日期");
  }
  return value;
}

function requiredText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") throw new Error(`${field} 必须是字符串`);
  const result = value.trim();
  if (!result || result.length > maxLength) {
    throw new Error(`${field} 长度无效`);
  }
  return result;
}

function parsePayload(value: unknown): SiteUpdateUploadPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("请求体必须是 JSON 对象");
  }
  const candidate = value as Record<string, unknown>;
  const id = requiredText(candidate.id, "id", 80).toLowerCase();
  if (!UPDATE_ID.test(id)) throw new Error("id 只能包含小写字母、数字和连字符");
  const date = parseDate(candidate.date);
  const displayDate = requiredText(candidate.displayDate, "displayDate", 32);
  const kind = candidate.kind;
  if (typeof kind !== "string" || !KINDS.has(kind as SiteUpdate["kind"])) {
    throw new Error("kind 必须是站点更新、版本或壁纸上新");
  }
  const category = candidate.category == null ? "新功能" : candidate.category;
  if (typeof category !== "string" || !CATEGORIES.has(category as UpdateCategory)) {
    throw new Error("category 必须是新功能、体验优化或修复");
  }
  if (!Array.isArray(candidate.details) || candidate.details.length < 1 || candidate.details.length > 8) {
    throw new Error("details 必须是 1 到 8 条文字");
  }
  const details = candidate.details.map((detail) => requiredText(detail, "details", 200));
  const releaseUrl = candidate.releaseUrl == null ? undefined : requiredText(candidate.releaseUrl, "releaseUrl", 500);
  if (releaseUrl && !/^https:\/\//.test(releaseUrl)) {
    throw new Error("releaseUrl 必须使用 HTTPS");
  }
  if (candidate.current != null && typeof candidate.current !== "boolean") {
    throw new Error("current 必须是布尔值");
  }
  let themeIds: string[] | undefined;
  if (candidate.themeIds != null) {
    if (!Array.isArray(candidate.themeIds) || candidate.themeIds.length < 1 || candidate.themeIds.length > 12) {
      throw new Error("themeIds 必须是 1 到 12 个主题 id");
    }
    themeIds = candidate.themeIds.map((themeId) => {
      const id = requiredText(themeId, "themeIds", 80).toLowerCase();
      if (!THEME_ID.test(id)) throw new Error("themeIds 含有非法主题 id");
      return id;
    });
    if (new Set(themeIds).size !== themeIds.length) throw new Error("themeIds 不能重复");
  }
  if (kind === "壁纸上新" && (!themeIds || themeIds.length === 0)) {
    throw new Error("壁纸上新必须提供 themeIds");
  }
  if (candidate.images != null) {
    throw new Error("请使用 themeIds，由服务端生成公开主题预览图");
  }
  return {
    id,
    date,
    displayDate,
    kind: kind as SiteUpdate["kind"],
    category: category as UpdateCategory,
    version: requiredText(candidate.version, "version", 40),
    title: requiredText(candidate.title, "title", 100),
    summary: requiredText(candidate.summary, "summary", 400),
    details,
    current: candidate.current as boolean | undefined,
    releaseUrl,
    themeIds,
  };
}

function rowToUpdate(row: SiteUpdateRow): SiteUpdate & { createdAt: string } {
  return {
    id: row.id,
    date: row.date,
    displayDate: row.displayDate,
    kind: row.kind,
    category: row.category,
    version: row.version,
    title: row.title,
    summary: row.summary,
    details: JSON.parse(row.detailsJson) as string[],
    images: JSON.parse(row.imagesJson) as SiteUpdateImage[],
    releaseUrl: row.releaseUrl ?? undefined,
    current: row.current === 1,
    createdAt: row.createdAt,
  };
}

export async function listDynamicSiteUpdates(db: D1Database) {
  const rows = await db.prepare(`
    SELECT
      id,
      date,
      display_date AS displayDate,
      kind,
      category,
      version,
      title,
      summary,
      details_json AS detailsJson,
      images_json AS imagesJson,
      release_url AS releaseUrl,
      current,
      created_at AS createdAt
    FROM site_updates
    ORDER BY date DESC, created_at DESC, id DESC
  `).all<SiteUpdateRow>();
  return rows.results.map(rowToUpdate);
}

export async function handleDynamicSiteUpdatesList(db: D1Database) {
  return jsonResponse(await listDynamicSiteUpdates(db));
}

async function resolveThemeImages(
  env: UpdateStorageEnv,
  themeIds: string[] | undefined,
): Promise<SiteUpdateImage[]> {
  if (!themeIds) return [];
  const images: SiteUpdateImage[] = [];
  for (const themeId of themeIds) {
    const row = await env.DB.prepare(`
      SELECT id, theme_json AS themeJson, object_key AS objectKey
      FROM uploaded_themes
      WHERE id = ?
    `).bind(themeId).first<UploadedThemeRow>();
    if (!row) throw new Error(`主题 ${themeId} 尚未公开`);
    const object = await env.THEMES.head(row.objectKey);
    if (!object) throw new Error(`主题 ${themeId} 的公开图片不存在`);
    const width = Number(object.customMetadata?.width);
    const height = Number(object.customMetadata?.height);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
      throw new Error(`主题 ${themeId} 缺少有效图片尺寸`);
    }
    let theme: { name?: unknown };
    try {
      theme = JSON.parse(row.themeJson) as { name?: unknown };
    } catch {
      throw new Error(`主题 ${themeId} 元数据无效`);
    }
    const name = typeof theme.name === "string" && theme.name.trim() ? theme.name.trim() : themeId;
    images.push({
      src: `/api/themes/assets/${themeId}`,
      alt: `${name}壁纸预览`,
      width,
      height,
    });
  }
  return images;
}

export async function handleDynamicSiteUpdateUpload(
  request: Request,
  env: UpdateStorageEnv,
  auth: ThemeUploadAuthConfig,
) {
  if (!await isThemeUploadAuthorized(request, auth)) {
    return jsonResponse({ error: "需要月海管理员账号或有效上传令牌" }, 401);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ error: "请求必须使用 application/json" }, 415);
  }

  let payload: SiteUpdateUploadPayload;
  try {
    payload = parsePayload(await request.json());
  } catch (error) {
    return jsonResponse({ error: errorMessage(error) }, 400);
  }

  const existing = await env.DB.prepare("SELECT id FROM site_updates WHERE id = ?")
    .bind(payload.id)
    .first();
  if (existing) return jsonResponse({ error: "更新记录 id 已存在" }, 409);

  let images: SiteUpdateImage[];
  try {
    images = await resolveThemeImages(env, payload.themeIds);
  } catch (error) {
    const message = errorMessage(error);
    return jsonResponse({ error: message }, message.includes("尚未公开") || message.includes("公开图片不存在") ? 404 : 400);
  }

  const createdAt = new Date().toISOString();
  const record = {
    id: payload.id,
    date: payload.date,
    displayDate: payload.displayDate,
    kind: payload.kind,
    category: payload.category as UpdateCategory,
    version: payload.version,
    title: payload.title,
    summary: payload.summary,
    details: payload.details,
    images,
    releaseUrl: payload.releaseUrl,
    current: payload.current ?? false,
    createdAt,
  } satisfies SiteUpdate & { createdAt: string };

  try {
    await env.DB.prepare(`
      INSERT INTO site_updates (
        id, date, display_date, kind, category, version, title, summary,
        details_json, images_json, release_url, current, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      record.id,
      record.date,
      record.displayDate,
      record.kind,
      record.category,
      record.version,
      record.title,
      record.summary,
      JSON.stringify(record.details),
      JSON.stringify(record.images),
      record.releaseUrl ?? null,
      record.current ? 1 : 0,
      record.createdAt,
    ).run();
  } catch (error) {
    if (error instanceof Error && /unique|constraint/i.test(error.message)) {
      return jsonResponse({ error: "更新记录 id 已存在" }, 409);
    }
    throw error;
  }

  return jsonResponse(record, 201);
}
