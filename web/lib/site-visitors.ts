import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { siteVisitorDays, siteVisitors } from "../db/schema";

const VISITOR_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ATTRIBUTION_PATTERN = /^[a-z0-9._-]{1,64}$/;

export const SITE_VISITOR_COOKIE = "moonsea_site_visitor";
export const SITE_VISITOR_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export function readSiteVisitorId(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const segment of cookieHeader.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) continue;
    const name = segment.slice(0, separator).trim();
    const value = segment.slice(separator + 1).trim();
    if (name === SITE_VISITOR_COOKIE && VISITOR_ID_PATTERN.test(value)) {
      return value.toLowerCase();
    }
  }
  return null;
}

export function createSiteVisitorId() {
  return crypto.randomUUID();
}

export function siteVisitorCookie(visitorId: string) {
  return [
    `${SITE_VISITOR_COOKIE}=${visitorId}`,
    `Max-Age=${SITE_VISITOR_MAX_AGE_SECONDS}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export function normalizeAttribution(
  value: string | null | undefined,
  fallback: string | null,
) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return ATTRIBUTION_PATTERN.test(normalized) ? normalized : fallback;
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

export async function recordSiteVisitor(
  visitorId: string,
  source: string,
  campaign: string | null,
  content: string | null,
  now = new Date(),
) {
  const visitorHash = await hashVisitorId(visitorId);
  const timestamp = now.toISOString();
  const day = timestamp.slice(0, 10);
  const db = getDb();

  await db.batch([
    db
      .insert(siteVisitors)
      .values({
        visitorHash,
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
        pageViewCount: 1,
        firstSource: source,
        lastSource: source,
        firstCampaign: campaign,
        lastCampaign: campaign,
        firstContent: content,
        lastContent: content,
      })
      .onConflictDoUpdate({
        target: siteVisitors.visitorHash,
        set: {
          lastSeenAt: timestamp,
          pageViewCount: sql`${siteVisitors.pageViewCount} + 1`,
          lastSource: source,
          lastCampaign: campaign,
          lastContent: content,
        },
      }),
    db
      .insert(siteVisitorDays)
      .values({
        day,
        visitorHash,
        source,
        campaign,
        content,
        pageViewCount: 1,
      })
      .onConflictDoUpdate({
        target: [siteVisitorDays.day, siteVisitorDays.visitorHash],
        set: {
          pageViewCount: sql`${siteVisitorDays.pageViewCount} + 1`,
        },
      }),
  ]);
}
