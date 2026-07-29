CREATE TABLE `site_visitor_days` (
	`day` text NOT NULL,
	`visitor_hash` text NOT NULL,
	`source` text NOT NULL,
	`campaign` text,
	`page_view_count` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`day`, `visitor_hash`)
);
--> statement-breakpoint
CREATE TABLE `site_visitors` (
	`visitor_hash` text PRIMARY KEY NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`page_view_count` integer DEFAULT 1 NOT NULL,
	`first_source` text NOT NULL,
	`last_source` text NOT NULL,
	`first_campaign` text,
	`last_campaign` text
);
