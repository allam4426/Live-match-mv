ALTER TABLE `push_subscriptions` ADD `team_ids` text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD `tournament_ids` text NOT NULL DEFAULT '[]';