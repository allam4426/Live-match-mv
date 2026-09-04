ALTER TABLE `matches` ADD `live_notification_sent` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `matches` ADD `finished_notification_sent` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE `matches` SET `live_notification_sent` = 1 WHERE `status` = 'live';
--> statement-breakpoint
UPDATE `matches` SET `finished_notification_sent` = 1 WHERE `status` = 'finished';