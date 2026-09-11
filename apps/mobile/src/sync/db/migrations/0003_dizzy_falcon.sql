CREATE TABLE `album_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`album_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`position` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `album_assets_album_idx` ON `album_assets` (`album_id`);--> statement-breakpoint
CREATE TABLE `post_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`post_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`position` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `post_assets_post_idx` ON `post_assets` (`post_id`);--> statement-breakpoint
ALTER TABLE `albums` DROP COLUMN `assets`;--> statement-breakpoint
ALTER TABLE `albums` DROP COLUMN `post_history`;--> statement-breakpoint
ALTER TABLE `albums` DROP COLUMN `last_posted_at`;--> statement-breakpoint
ALTER TABLE `assets` DROP COLUMN `post_history`;--> statement-breakpoint
ALTER TABLE `assets` DROP COLUMN `last_posted_at`;--> statement-breakpoint
ALTER TABLE `posts` DROP COLUMN `asset_refs`;