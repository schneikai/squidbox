CREATE TABLE `contact_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`pinned_list_id` text,
	`pinned_at` integer
);
