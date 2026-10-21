ALTER TABLE `assets` ADD `files_removed_at` integer;--> statement-breakpoint
UPDATE `assets` SET `files_removed_at` = `purged_at` WHERE `purged_at` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `assets_purged_files_idx` ON `assets` (`id`) WHERE "assets"."purged_at" is not null and "assets"."files_removed_at" is null;--> statement-breakpoint
CREATE TRIGGER `assets_unpurged_files` AFTER UPDATE OF `purged_at` ON `assets` FOR EACH ROW WHEN NEW.`purged_at` IS NULL AND NEW.`files_removed_at` IS NOT NULL BEGIN UPDATE `assets` SET `files_removed_at` = NULL WHERE `id` = NEW.`id`; END;
