ALTER TABLE `assets` ADD `files_removed_at` integer;--> statement-breakpoint
UPDATE `assets` SET `files_removed_at` = `purged_at` WHERE `purged_at` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `assets_purged_files_idx` ON `assets` (`id`) WHERE "assets"."purged_at" is not null and "assets"."files_removed_at" is null;
