CREATE TABLE `post_copies` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`post_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`sent_at` integer,
	`posts` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `post_copies_post_idx` ON `post_copies` (`post_id`,`created_at`,`id`) WHERE "post_copies"."deleted_at" is null;--> statement-breakpoint
DROP INDEX `posts_channel_root_idx`;--> statement-breakpoint
ALTER TABLE `posts` ADD `mentions` text;--> statement-breakpoint
ALTER TABLE `posts` DROP COLUMN `channel_id`;--> statement-breakpoint
ALTER TABLE `posts` DROP COLUMN `channel_root_id`;--> statement-breakpoint
ALTER TABLE `posts` DROP COLUMN `extra_channel_ids`;