CREATE TABLE `sponsorships` (
	`check_id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`day` text NOT NULL,
	`reserved_micros` integer NOT NULL,
	`active_until` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sponsorships_day_idx` ON `sponsorships` (`day`);--> statement-breakpoint
CREATE INDEX `sponsorships_owner_day_idx` ON `sponsorships` (`owner`,`day`);