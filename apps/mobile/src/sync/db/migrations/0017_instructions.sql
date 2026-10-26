CREATE TABLE `instructions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`writing` text,
	`persona_draft` text,
	`vision_tagging` text
);
