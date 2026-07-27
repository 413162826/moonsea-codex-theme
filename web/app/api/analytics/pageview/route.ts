import {
  incrementDailyMetric,
  METRIC_TYPES,
  PUBLIC_PAGE_PATHS,
} from "../../../../lib/daily-metrics";

type PageViewPayload = {
  path?: string;
};

export async function POST(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  if (request.headers.get("origin") !== requestOrigin) {
    return Response.json({ error: "请求来源无效" }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 512) {
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

  await incrementDailyMetric(METRIC_TYPES.pageView, path);
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
