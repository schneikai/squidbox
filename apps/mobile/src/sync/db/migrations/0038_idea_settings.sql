CREATE TABLE `idea_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`post_ideas_on` integer NOT NULL,
	`repost_ideas_on` integer NOT NULL,
	`post_ideas_prompt` text,
	`repost_ideas_prompt` text
);
--> statement-breakpoint
ALTER TABLE `instructions` ADD `more_ideas` text;