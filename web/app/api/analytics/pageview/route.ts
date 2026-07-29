import {
  incrementDailyMetric,
  METRIC_TYPES,
  PUBLIC_PAGE_PATHS,
} from "../../../../lib/daily-metrics";
import {
  createSiteVisitorId,
  normalizeAttribution,
  readSiteVisitorId,
  recordSiteVisitor,
  siteVisitorCookie,
} from "../../../../lib/site-visitors";

type PageViewPayload = {
  path?: string;
  source?: string;
  campaign?: string;
  content?: string;
};

export async function POST(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  if (request.headers.get("origin") !== requestOrigin) {
    return Response.json({ error: "请求来源无效" }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1024) {
    return Response.json({ error: "请求内容过大" }, { status: 413 });
  }

  let payload: PageViewPayload;
  try {
    payload = await request.json() as PageViewPayload;
  } catch {
    return Response.json({ error: "请求格式无效" }, { status: 400 });
  }

  const path = payload.path?.trim() ?? "";
  if (!PUBLIC_PAGE_PATHS.has(path)) {
    return Response.json({ error: "页面路径无效" }, { status: 400 });
  }

  const source = normalizeAttribution(payload.source, "direct") ?? "direct";
  const campaign = normalizeAttribution(payload.campaign, null);
  const content = normalizeAttribution(payload.content, null);
  const existingVisitorId = readSiteVisitorId(request);
  const visitorId = existingVisitorId ?? createSiteVisitorId();

  await Promise.all([
    incrementDailyMetric(METRIC_TYPES.pageView, path),
    recordSiteVisitor(visitorId, source, campaign, content),
  ]);

  const headers = new Headers({ "Cache-Control": "no-store" });
  if (!existingVisitorId) {
    headers.set("Set-Cookie", siteVisitorCookie(visitorId));
  }
  return new Response(null, {
    status: 204,
    headers,
  });
}
