CREATE TABLE `row_changes` (
	`table_name` text NOT NULL,
	`row_id` text NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `row_changes_table_row_idx` ON `row_changes` (`table_name`,`row_id`);--> statement-breakpoint
CREATE INDEX `row_changes_table_version_idx` ON `row_changes` (`table_name`,`version`);
--> statement-breakpoint
CREATE TRIGGER `assets_changes_insert` AFTER INSERT ON `assets` BEGIN INSERT INTO `row_changes` (`table_name`, `row_id`, `version`) VALUES ('assets', NEW.`id`, (SELECT COALESCE(MAX(`version`), 0) + 1 FROM `row_changes` WHERE `table_name` = 'assets')) ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `version` = excluded.`version`; END;
--> statement-breakpoint
CREATE TRIGGER `assets_changes_update` AFTER UPDATE ON `assets` BEGIN INSERT INTO `row_changes` (`table_name`, `row_id`, `version`) VALUES ('assets', NEW.`id`, (SELECT COALESCE(MAX(`version`), 0) + 1 FROM `row_changes` WHERE `table_name` = 'assets')) ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `version` = excluded.`version`; END;
--> statement-breakpoint
CREATE TRIGGER `assets_changes_delete` AFTER DELETE ON `assets` BEGIN INSERT INTO `row_changes` (`table_name`, `row_id`, `version`) VALUES ('assets', OLD.`id`, (SELECT COALESCE(MAX(`version`), 0) + 1 FROM `row_changes` WHERE `table_name` = 'assets')) ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `version` = excluded.`version`; END;
--> statement-breakpoint
CREATE TRIGGER `albums_changes_insert` AFTER INSERT ON `albums` BEGIN INSERT INTO `row_changes` (`table_name`, `row_id`, `version`) VALUES ('albums', NEW.`id`, (SELECT COALESCE(MAX(`version`), 0) + 1 FROM `row_changes` WHERE `table_name` = 'albums')) ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `version` = excluded.`version`; END;
--> statement-breakpoint
CREATE TRIGGER `albums_changes_update` AFTER UPDATE ON `albums` BEGIN INSERT INTO `row_changes` (`table_name`, `row_id`, `version`) VALUES ('albums', NEW.`id`, (SELECT COALESCE(MAX(`version`), 0) + 1 FROM `row_changes` WHERE `table_name` = 'albums')) ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `version` = excluded.`version`; END;
--> statement-breakpoint
CREATE TRIGGER `albums_changes_delete` AFTER DELETE ON `albums` BEGIN INSERT INTO `row_changes` (`table_name`, `row_id`, `version`) VALUES ('albums', OLD.`id`, (SELECT COALESCE(MAX(`version`), 0) + 1 FROM `row_changes` WHERE `table_name` = 'albums')) ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `version` = excluded.`version`; END;
--> statement-breakpoint
CREATE TRIGGER `posts_changes_insert` AFTER INSERT ON `posts` BEGIN INSERT INTO `row_changes` (`table_name`, `row_id`, `version`) VALUES ('posts', NEW.`id`, (SELECT COALESCE(MAX(`version`), 0) + 1 FROM `row_changes` WHERE `table_name` = 'posts')) ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `version` = excluded.`version`; END;
--> statement-breakpoint
CREATE TRIGGER `posts_changes_update` AFTER UPDATE ON `posts` BEGIN INSERT INTO `row_changes` (`table_name`, `row_id`, `version`) VALUES ('posts', NEW.`id`, (SELECT COALESCE(MAX(`version`), 0) + 1 FROM `row_changes` WHERE `table_name` = 'posts')) ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `version` = excluded.`version`; END;
--> statement-breakpoint
CREATE TRIGGER `posts_changes_delete` AFTER DELETE ON `posts` BEGIN INSERT INTO `row_changes` (`table_name`, `row_id`, `version`) VALUES ('posts', OLD.`id`, (SELECT COALESCE(MAX(`version`), 0) + 1 FROM `row_changes` WHERE `table_name` = 'posts')) ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `version` = excluded.`version`; END;
--> statement-breakpoint
CREATE TRIGGER `album_assets_changes_insert` AFTER INSERT ON `album_assets` BEGIN INSERT INTO `row_changes` (`table_name`, `row_id`, `version`) VALUES ('album_assets', NEW.`id`, (SELECT COALESCE(MAX(`version`), 0) + 1 FROM `row_changes` WHERE `table_name` = 'album_assets')) ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `version` = excluded.`version`; END;
--> statement-breakpoint
CREATE TRIGGER `album_assets_changes_update` AFTER UPDATE ON `album_assets` BEGIN INSERT INTO `row_changes` (`table_name`, `row_id`, `version`) VALUES ('album_assets', NEW.`id`, (SELECT COALESCE(MAX(`version`), 0) + 1 FROM `row_changes` WHERE `table_name` = 'album_assets')) ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `version` = excluded.`version`; END;
--> statement-breakpoint
CREATE TRIGGER `album_assets_changes_delete` AFTER DELETE ON `album_assets` BEGIN INSERT INTO `row_changes` (`table_name`, `row_id`, `version`) VALUES ('album_assets', OLD.`id`, (SELECT COALESCE(MAX(`version`), 0) + 1 FROM `row_changes` WHERE `table_name` = 'album_assets')) ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `version` = excluded.`version`; END;
--> statement-breakpoint
CREATE TRIGGER `post_assets_changes_insert` AFTER INSERT ON `post_assets` BEGIN INSERT INTO `row_changes` (`table_name`, `row_id`, `version`) VALUES ('post_assets', NEW.`id`, (SELECT COALESCE(MAX(`version`), 0) + 1 FROM `row_changes` WHERE `table_name` = 'post_assets')) ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `version` = excluded.`version`; END;
--> statement-breakpoint
CREATE TRIGGER `post_assets_changes_update` AFTER UPDATE ON `post_assets` BEGIN INSERT INTO `row_changes` (`table_name`, `row_id`, `version`) VALUES ('post_assets', NEW.`id`, (SELECT COALESCE(MAX(`version`), 0) + 1 FROM `row_changes` WHERE `table_name` = 'post_assets')) ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `version` = excluded.`version`; END;
--> statement-breakpoint
CREATE TRIGGER `post_assets_changes_delete` AFTER DELETE ON `post_assets` BEGIN INSERT INTO `row_changes` (`table_name`, `row_id`, `version`) VALUES ('post_assets', OLD.`id`, (SELECT COALESCE(MAX(`version`), 0) + 1 FROM `row_changes` WHERE `table_name` = 'post_assets')) ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `version` = excluded.`version`; END;
