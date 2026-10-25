CREATE TABLE `personas` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`about_you` text NOT NULL,
	`content_tags` text NOT NULL,
	`tone` text NOT NULL,
	`use_emoji` integer NOT NULL,
	`rules` text NOT NULL,
	`example_posts` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prompt_buttons` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`prompt` text NOT NULL,
	`placement` text NOT NULL,
	`icon` text,
	`position` text NOT NULL
);
