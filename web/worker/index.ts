/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  handleThemeAsset,
  handleThemeManifest,
  handleThemeUpload,
} from "../lib/uploaded-themes";
import { hasAllowedPlatformEmail } from "../lib/theme-upload-auth";
import { getThemesWithUploads } from "../lib/theme-catalog";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  THEMES: R2Bucket;
  MOONSEA_ADMIN_EMAILS?: string;
  MOONSEA_THEME_UPLOAD_TOKEN?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const THEME_LIST_CACHE_TTL_MS = 60_000;
let themeListCache: { body: string; expiresAt: number } | null = null;
let themeListLoad: Promise<string> | null = null;

async function getCachedThemeList(db: D1Database) {
  const now = Date.now();
  if (themeListCache && themeListCache.expiresAt > now) {
    return themeListCache.body;
  }
  if (!themeListLoad) {
    themeListLoad = getThemesWithUploads(db)
      .then((themes) => JSON.stringify(themes))
      .finally(() => {
        themeListLoad = null;
      });
  }
  const body = await themeListLoad;
  themeListCache = {
    body,
    expiresAt: Date.now() + THEME_LIST_CACHE_TTL_MS,
  };
  return body;
}

function themeListResponse(body: string) {
  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if (url.pathname === "/theme-catalog-v1.json") {
      return handleThemeManifest(request, env.DB);
    }

    if (url.pathname === "/api/themes" && request.method === "GET") {
      return themeListResponse(await getCachedThemeList(env.DB));
    }

    if (url.pathname === "/api/admin/access" && request.method === "GET") {
      return Response.json({
        adminAccess: hasAllowedPlatformEmail(request, env.MOONSEA_ADMIN_EMAILS),
      }, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    if (url.pathname === "/api/admin/themes" && request.method === "POST") {
      return handleThemeUpload(request, env, {
        allowedEmails: env.MOONSEA_ADMIN_EMAILS,
        uploadToken: env.MOONSEA_THEME_UPLOAD_TOKEN,
      });
    }

    const themeAsset = url.pathname.match(/^\/api\/themes\/assets\/([a-z0-9-]+)$/);
    if (themeAsset) {
      return handleThemeAsset(request, env, themeAsset[1]);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
