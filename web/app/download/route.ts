import {
  incrementDailyMetric,
  METRIC_TYPES,
} from "../../lib/daily-metrics";
import {
  createDownloadVisitorId,
  downloadVisitorCookie,
  readDownloadVisitorId,
  recordDownloadVisitor,
} from "../../lib/download-visitors";

const DOWNLOADS = Object.freeze({
  windows: "https://github.com/413162826/moonsea-codex-theme/releases/latest/download/Moonsea-Codex-Windows-x64-Setup.exe",
  macos: "https://github.com/413162826/moonsea-codex-theme/releases/latest/download/Moonsea-Codex-macOS.zip",
});

type DownloadPlatform = keyof typeof DOWNLOADS;

function detectPlatform(request: Request): DownloadPlatform | null {
  const requested = new URL(request.url).searchParams.get("platform");
  if (requested === "windows" || requested === "macos") return requested;

  const userAgent = request.headers.get("user-agent") ?? "";
  if (/windows/i.test(userAgent)) return "windows";
  if (/macintosh|mac os x/i.test(userAgent) && !/iphone|ipad|ipod/i.test(userAgent)) {
    return "macos";
  }
  return null;
}

export async function GET(request: Request) {
  const platform = detectPlatform(request);
  if (!platform) {
    return Response.redirect(new URL("/download/choose", request.url), 302);
  }

  const existingVisitorId = readDownloadVisitorId(request);
  const visitorId = existingVisitorId ?? createDownloadVisitorId();

  try {
    await Promise.all([
      incrementDailyMetric(METRIC_TYPES.download, platform),
      recordDownloadVisitor(visitorId, platform),
    ]);
  } catch {
    // 统计属于非关键链路，不阻断用户下载。
  }

  const headers = new Headers({ Location: DOWNLOADS[platform] });
  if (!existingVisitorId) headers.set("Set-Cookie", downloadVisitorCookie(visitorId));
  return new Response(null, { status: 302, headers });
}

export function HEAD(request: Request) {
  const platform = detectPlatform(request);
  if (!platform) {
    return Response.redirect(new URL("/download/choose", request.url), 302);
  }
  return Response.redirect(DOWNLOADS[platform], 302);
}
