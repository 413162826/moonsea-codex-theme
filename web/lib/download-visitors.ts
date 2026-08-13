import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { downloadVisitorDays, downloadVisitors } from "../db/schema";

const VISITOR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DOWNLOAD_VISITOR_COOKIE = "moonsea_download_visitor";
export const DOWNLOAD_VISITOR_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export function readDownloadVisitorId(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const segment of cookieHeader.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) continue;
    const name = segment.slice(0, separator).trim();
    const value = segment.slice(separator + 1).trim();
    if (name === DOWNLOAD_VISITOR_COOKIE && VISITOR_ID_PATTERN.test(value)) {
      return value.toLowerCase();
    }
  }
  return null;
}

export function createDownloadVisitorId() {
  return crypto.randomUUID();
}

export function downloadVisitorCookie(visitorId: string) {
  return [
    `${DOWNLOAD_VISITOR_COOKIE}=${visitorId}`,
    `Max-Age=${DOWNLOAD_VISITOR_MAX_AGE_SECONDS}`,
    "Path=/download",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

async function hashVisitorId(visitorId: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(visitorId),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function recordDownloadVisitor(
  visitorId: string,
  platform: string,
  now = new Date(),
) {
  const visitorHash = await hashVisitorId(visitorId);
  const timestamp = now.toISOString();
  const db = getDb();
  await db.batch([
    db
      .insert(downloadVisitors)
      .values({
        visitorHash,
        platform,
        firstDownloadedAt: timestamp,
        lastDownloadedAt: timestamp,
        downloadCount: 1,
      })
      .onConflictDoUpdate({
        target: downloadVisitors.visitorHash,
        set: {
          platform,
          lastDownloadedAt: timestamp,
          downloadCount: sql`${downloadVisitors.downloadCount} + 1`,
        },
      }),
    db
      .insert(downloadVisitorDays)
      .values({ day: timestamp.slice(0, 10), visitorHash, platform })
      .onConflictDoUpdate({
        target: [downloadVisitorDays.day, downloadVisitorDays.visitorHash],
        set: { platform },
      }),
  ]);
}
