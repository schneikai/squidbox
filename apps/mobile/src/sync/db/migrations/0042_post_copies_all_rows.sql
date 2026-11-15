DROP INDEX `post_copies_post_idx`;--> statement-breakpoint
CREATE INDEX `post_copies_post_idx` ON `post_copies` (`post_id`,`created_at`,`id`);