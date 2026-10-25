CREATE TABLE `ai_kinds` (
	`kind` text PRIMARY KEY NOT NULL,
	`chosen_model_id` text,
	`prompt` text
);
--> statement-breakpoint
CREATE TABLE `ai_models` (
	`kind` text NOT NULL,
	`model_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`kind`, `model_id`)
);
--> statement-breakpoint
CREATE TABLE `ai_scores` (
	`kind` text NOT NULL,
	`model_id` text NOT NULL,
	`score` integer NOT NULL,
	PRIMARY KEY(`kind`, `model_id`)
);
--> statement-breakpoint
CREATE TABLE `ai_vision_photos` (
	`asset_id` text PRIMARY KEY NOT NULL,
	`position` integer NOT NULL
);
