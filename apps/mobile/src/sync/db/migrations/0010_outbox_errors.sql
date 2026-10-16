ALTER TABLE `outbox` ADD `error` text;--> statement-breakpoint
CREATE INDEX `outbox_error_idx` ON `outbox` (`id`) WHERE "outbox"."error" is not null;