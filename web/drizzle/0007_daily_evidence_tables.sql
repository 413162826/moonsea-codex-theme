CREATE TABLE `download_visitor_days` (
	`day` text NOT NULL,
	`visitor_hash` text NOT NULL,
	`platform` text NOT NULL,
	PRIMARY KEY(`day`, `visitor_hash`)
);
--> statement-breakpoint
CREATE TABLE `installation_activity_days` (
	`day` text NOT NULL,
	`install_id` text NOT NULL,
	`platform` text NOT NULL,
	`app_version` text NOT NULL,
	PRIMARY KEY(`day`, `install_id`)
);
