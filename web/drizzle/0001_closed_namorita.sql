CREATE TABLE `daily_metrics` (
	`day` text NOT NULL,
	`metric_type` text NOT NULL,
	`dimension` text NOT NULL,
	`total` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`day`, `metric_type`, `dimension`)
);
