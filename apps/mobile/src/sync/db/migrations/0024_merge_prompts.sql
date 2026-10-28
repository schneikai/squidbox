ALTER TABLE `instructions` DROP COLUMN `writing_format`;--> statement-breakpoint
ALTER TABLE `instructions` DROP COLUMN `tags_system`;--> statement-breakpoint
ALTER TABLE `instructions` DROP COLUMN `themes_context`;--> statement-breakpoint
ALTER TABLE `instructions` DROP COLUMN `persona_framing`;--> statement-breakpoint
ALTER TABLE `instructions` DROP COLUMN `chat_context`;--> statement-breakpoint
-- Writing and Photo tags are now whole prompts, so a saved edit of the old texts goes back to the
-- default here at once; the server resets them the same way (its 0022) and the next pull brings
-- that reset with its clock.
UPDATE `instructions` SET `writing` = NULL, `vision_tagging` = NULL;
