import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const uploadedThemes = sqliteTable("uploaded_themes", {
  id: text("id").primaryKey(),
  themeJson: text("theme_json").notNull(),
  objectKey: text("object_key").notNull().unique(),
  contentType: text("content_type").notNull(),
  sha256: text("sha256").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull(),
});

export const siteUpdates = sqliteTable("site_updates", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  displayDate: text("display_date").notNull(),
  kind: text("kind").notNull(),
  category: text("category").notNull(),
  version: text("version").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  detailsJson: text("details_json").notNull(),
  imagesJson: text("images_json").notNull().default("[]"),
  releaseUrl: text("release_url"),
  current: integer("current").notNull().default(0),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("site_updates_date_created_idx").on(table.date, table.createdAt),
]);
