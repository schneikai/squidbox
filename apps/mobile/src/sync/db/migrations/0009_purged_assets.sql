DROP INDEX `assets_deleted_idx`;--> statement-breakpoint
ALTER TABLE `assets` ADD `purged_at` integer;--> statement-breakpoint
CREATE INDEX `assets_deleted_idx` ON `assets` (`deleted_at`,`id`,`purged_at`) WHERE "assets"."deleted_at" is not null and "assets"."purged_at" is null;