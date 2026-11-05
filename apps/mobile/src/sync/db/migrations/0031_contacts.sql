CREATE TABLE `contact_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`contact_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contact_links_target_idx` ON `contact_links` (`target_type`,`target_id`,`contact_id`) WHERE "contact_links"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `contact_links_contact_idx` ON `contact_links` (`contact_id`,`target_type`,`target_id`) WHERE "contact_links"."deleted_at" is null;--> statement-breakpoint
CREATE TABLE `contact_list_members` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`list_id` text NOT NULL,
	`contact_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contact_list_members_list_idx` ON `contact_list_members` (`list_id`,`contact_id`) WHERE "contact_list_members"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `contact_list_members_contact_idx` ON `contact_list_members` (`contact_id`,`list_id`) WHERE "contact_list_members"."deleted_at" is null;--> statement-breakpoint
CREATE TABLE `contact_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`notes` text,
	`position` text
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`is_favorite` integer NOT NULL,
	`favorited_at` integer,
	`notes` text,
	`x_handle` text,
	`bluesky_handle` text,
	`only_fans_handle` text,
	`jff_handle` text,
	`phone_number` text,
	`places` text NOT NULL,
	`avatar_filename` text
);
--> statement-breakpoint
CREATE INDEX `contacts_live_name_idx` ON `contacts` (`name`,`id`) WHERE "contacts"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE `instructions` ADD `contact_screenshot` text;--> statement-breakpoint
ALTER TABLE `outbox` ADD `uploaded_files` text DEFAULT '[]' NOT NULL;