CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`channel_id` text NOT NULL,
	`position` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `posts` ADD `channel_id` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `channel_root_id` text;--> statement-breakpoint
CREATE INDEX `posts_channel_root_idx` ON `posts` (`channel_root_id`,`id`) WHERE "posts"."deleted_at" is null and "posts"."channel_root_id" is not null;