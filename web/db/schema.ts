import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
