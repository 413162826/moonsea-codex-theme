CREATE TABLE `download_visitors` (
	`visitor_hash` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`first_downloaded_at` text NOT NULL,
	`last_downloaded_at` text NOT NULL,
	`download_count` integer DEFAULT 1 NOT NULL
);
