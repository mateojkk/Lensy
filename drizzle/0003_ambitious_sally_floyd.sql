CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`public_url` text
);
--> statement-breakpoint
CREATE INDEX `uploads_owner_created_idx` ON `uploads` (`owner`,`created_at`);--> statement-breakpoint
CREATE INDEX `uploads_created_idx` ON `uploads` (`created_at`);