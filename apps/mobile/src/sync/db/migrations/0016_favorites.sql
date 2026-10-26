CREATE TABLE `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`text` text NOT NULL,
	`source` text
);
--> statement-breakpoint
ALTER TABLE `personas` DROP COLUMN `example_posts`;