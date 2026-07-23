import { sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { installations } from "../../../db/schema";

const INSTALL_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const PLATFORMS = new Set(["win32", "darwin", "linux"]);
const ARCHITECTURES = new Set(["x64", "arm64"]);

type TelemetryPayload = {
  consent?: boolean;
  installId?: string;
  platform?: string;
  architecture?: string;
  appVersion?: string;
  channel?: string;
};

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4096) {
    return Response.json({ error: "请求内容过大" }, { status: 413 });
  }

  let payload: TelemetryPayload;
  try {
    payload = await request.json() as TelemetryPayload;
  } catch {
    return Response.json({ error: "请求格式无效" }, { status: 400 });
  }

  if (payload.consent !== true) {
    return Response.json({ error: "缺少明确的使用统计授权" }, { status: 400 });
  }

  const installId = payload.installId?.trim().toLowerCase() ?? "";
  const platform = payload.platform?.trim().toLowerCase() ?? "";
  const architecture = payload.architecture?.trim().toLowerCase() ?? "";
  const appVersion = payload.appVersion?.trim() ?? "";
  const channel = payload.channel?.trim().toLowerCase() || "stable";

  if (!INSTALL_ID_PATTERN.test(installId)
    || !PLATFORMS.has(platform)
    || !ARCHITECTURES.has(architecture)
    || !VERSION_PATTERN.test(appVersion)
    || channel !== "stable") {
    return Response.json({ error: "使用统计字段无效" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const db = getDb();
  await db
    .insert(installations)
    .values({
      installId,
      platform,
      architecture,
      appVersion,
      channel,
      firstSeenAt: now,
      lastSeenAt: now,
      reportCount: 1,
    })
    .onConflictDoUpdate({
      target: installations.installId,
      set: {
        platform,
        architecture,
        appVersion,
        channel,
        lastSeenAt: now,
        reportCount: sql`${installations.reportCount} + 1`,
      },
    });

  return Response.json({ accepted: true }, {
    status: 202,
    headers: { "Cache-Control": "no-store" },
  });
}
