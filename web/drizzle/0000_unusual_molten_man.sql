CREATE TABLE `installations` (
	`install_id` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`architecture` text NOT NULL,
	`app_version` text NOT NULL,
	`channel` text DEFAULT 'stable' NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`report_count` integer DEFAULT 1 NOT NULL
);
