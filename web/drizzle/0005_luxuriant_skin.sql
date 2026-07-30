CREATE TABLE `uploaded_themes` (
	`id` text PRIMARY KEY NOT NULL,
	`theme_json` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`sha256` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uploaded_themes_object_key_unique` ON `uploaded_themes` (`object_key`);