CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`media_library_asset_id` text NOT NULL,
	`media_type` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`file_size` integer NOT NULL,
	`duration` real,
	`filename` text NOT NULL,
	`thumbnail_filename` text NOT NULL,
	`is_favorite` integer NOT NULL,
	`notes` text,
	`post_history` text NOT NULL,
	`last_posted_at` integer,
	`old_file_id` text,
	`is_file_synced` integer NOT NULL,
	`is_thumbnail_synced` integer NOT NULL,
	`is_synced` integer NOT NULL,
	`sync_error` text
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`collection` text NOT NULL,
	`record_id` text NOT NULL,
	`op` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outbox_collection_record_idx` ON `outbox` (`collection`,`record_id`);--> statement-breakpoint
CREATE TABLE `sync_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
