import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { dailyMetrics } from "../db/schema";

export const PUBLIC_PAGE_PATHS = new Set(["/", "/themes", "/download/choose"]);
export const METRIC_TYPES = Object.freeze({
  download: "download",
  pageView: "page_view",
});

export async function incrementDailyMetric(
  metricType: string,
  dimension: string,
  now = new Date(),
) {
  const day = now.toISOString().slice(0, 10);
  const db = getDb();
  await db
    .insert(dailyMetrics)
    .values({ day, metricType, dimension, total: 1 })
    .onConflictDoUpdate({
      target: [
        dailyMetrics.day,
        dailyMetrics.metricType,
        dailyMetrics.dimension,
      ],
      set: {
        total: sql`${dailyMetrics.total} + 1`,
      },
    });
}
