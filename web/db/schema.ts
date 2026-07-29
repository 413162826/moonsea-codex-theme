import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const installations = sqliteTable("installations", {
  installId: text("install_id").primaryKey(),
  platform: text("platform").notNull(),
  architecture: text("architecture").notNull(),
  appVersion: text("app_version").notNull(),
  channel: text("channel").notNull().default("stable"),
  firstSeenAt: text("first_seen_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  reportCount: integer("report_count").notNull().default(1),
});

export const dailyMetrics = sqliteTable("daily_metrics", {
  day: text("day").notNull(),
  metricType: text("metric_type").notNull(),
  dimension: text("dimension").notNull(),
  total: integer("total").notNull().default(1),
}, (table) => [
  primaryKey({ columns: [table.day, table.metricType, table.dimension] }),
]);

export const downloadVisitors = sqliteTable("download_visitors", {
  visitorHash: text("visitor_hash").primaryKey(),
  platform: text("platform").notNull(),
  firstDownloadedAt: text("first_downloaded_at").notNull(),
  lastDownloadedAt: text("last_downloaded_at").notNull(),
  downloadCount: integer("download_count").notNull().default(1),
});

export const siteVisitors = sqliteTable("site_visitors", {
  visitorHash: text("visitor_hash").primaryKey(),
  firstSeenAt: text("first_seen_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  pageViewCount: integer("page_view_count").notNull().default(1),
  firstSource: text("first_source").notNull(),
  lastSource: text("last_source").notNull(),
  firstCampaign: text("first_campaign"),
  lastCampaign: text("last_campaign"),
  firstContent: text("first_content"),
  lastContent: text("last_content"),
});

export const siteVisitorDays = sqliteTable("site_visitor_days", {
  day: text("day").notNull(),
  visitorHash: text("visitor_hash").notNull(),
  source: text("source").notNull(),
  campaign: text("campaign"),
  content: text("content"),
  pageViewCount: integer("page_view_count").notNull().default(1),
}, (table) => [
  primaryKey({ columns: [table.day, table.visitorHash] }),
]);
