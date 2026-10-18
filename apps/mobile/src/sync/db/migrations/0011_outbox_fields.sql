ALTER TABLE `outbox` ADD `fields` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
UPDATE `outbox` SET `fields` = (SELECT json_group_object(`key`, `outbox`.`updated_at`) FROM json_each(`outbox`.`payload`) WHERE `key` NOT IN ('id', 'createdAt', 'updatedAt'));
