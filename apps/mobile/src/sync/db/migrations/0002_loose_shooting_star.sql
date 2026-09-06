CREATE TABLE `albums` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`assets` text NOT NULL,
	`is_favorite` integer NOT NULL,
	`archived_at` integer,
	`post_history` text NOT NULL,
	`last_posted_at` integer,
	`show_in_post_suggestions_after` integer,
	`old_collection_name` text,
	`notes` text,
	`sort_order` text,
	`smart_album_type` text
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`text` text NOT NULL,
	`asset_refs` text NOT NULL,
	`is_favorite` integer NOT NULL,
	`posted_at` integer,
	`re_post_id` text,
	`is_ignored_for_repost` integer NOT NULL,
	`suggest_repost_at` integer NOT NULL,
	`has_been_reposted` integer NOT NULL
);
