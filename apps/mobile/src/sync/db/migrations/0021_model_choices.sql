CREATE TABLE `model_choices` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`writing_model` text,
	`vision_model` text
);
