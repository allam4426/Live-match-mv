ALTER TABLE `tournaments` ADD `parent_tournament_id` integer;
--> statement-breakpoint
ALTER TABLE `tournaments` ADD `stage_type` text DEFAULT 'championship';