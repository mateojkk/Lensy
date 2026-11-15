CREATE TABLE `checks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`created_at` text NOT NULL,
	`name` text NOT NULL,
	`media` text NOT NULL,
	`media_type` text NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`result` text NOT NULL,
	`shared` integer DEFAULT 0 NOT NULL,
	`listed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `checks_owner_idx` ON `checks` (`owner`);--> statement-breakpoint
CREATE INDEX `checks_feed_idx` ON `checks` (`listed`);