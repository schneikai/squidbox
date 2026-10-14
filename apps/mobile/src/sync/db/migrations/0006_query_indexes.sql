DROP INDEX `album_assets_album_idx`;--> statement-breakpoint
CREATE INDEX `album_assets_album_position_idx` ON `album_assets` (`album_id`,`position`,`asset_id`) WHERE "album_assets"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `album_assets_asset_idx` ON `album_assets` (`asset_id`,`album_id`) WHERE "album_assets"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `assets_live_created_idx` ON `assets` (`created_at`,`id`,`is_favorite`,`media_type`) WHERE "assets"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `assets_deleted_idx` ON `assets` (`deleted_at`,`id`) WHERE "assets"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX `assets_unsynced_idx` ON `assets` (`id`) WHERE "assets"."is_synced" = 0 and "assets"."deleted_at" is null and "assets"."sync_error" is null;--> statement-breakpoint
CREATE INDEX `assets_sync_error_idx` ON `assets` (`id`) WHERE "assets"."sync_error" is not null and "assets"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `assets_notes_idx` ON `assets` (`id`,`notes`) WHERE "assets"."notes" is not null and "assets"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `post_assets_asset_idx` ON `post_assets` (`asset_id`,`post_id`) WHERE "post_assets"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `posts_live_posted_idx` ON `posts` (`posted_at`,`id`) WHERE "posts"."deleted_at" is null;