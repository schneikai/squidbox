ALTER TABLE `posts` ADD `thread_root_id` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `thread_index` integer;--> statement-breakpoint
CREATE INDEX `posts_thread_idx` ON `posts` (`thread_root_id`,`thread_index`,`id`) WHERE "posts"."deleted_at" is null and "posts"."thread_root_id" is not null;