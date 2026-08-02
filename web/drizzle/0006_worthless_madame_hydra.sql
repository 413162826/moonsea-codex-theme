CREATE TABLE `site_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`display_date` text NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`version` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`details_json` text NOT NULL,
	`images_json` text DEFAULT '[]' NOT NULL,
	`release_url` text,
	`current` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `site_updates_date_created_idx` ON `site_updates` (`date`,`created_at`);