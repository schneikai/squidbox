ALTER TABLE `ai_models` ADD `note` text;--> statement-breakpoint
ALTER TABLE `ai_models` ADD `is_hidden` integer DEFAULT false NOT NULL;