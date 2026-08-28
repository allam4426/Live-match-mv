CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`logo_url` text DEFAULT '' NOT NULL,
	`country` text NOT NULL,
	`sport` text DEFAULT 'football' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`home_team_id` integer,
	`away_team_id` integer,
	`home_score` integer DEFAULT 0 NOT NULL,
	`away_score` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`minute` text,
	`competition` text NOT NULL,
	`competition_logo` text,
	`kickoff_at` integer NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`sport` text DEFAULT 'football' NOT NULL,
	`tournament_id` integer,
	`venue` text,
	`match_group` text,
	`clock_anchor_ms` integer,
	FOREIGN KEY (`home_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`away_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `streams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`quality` text DEFAULT 'HD' NOT NULL,
	`language` text DEFAULT 'EN' NOT NULL,
	`embed_code` text,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `match_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`type` text NOT NULL,
	`minute` text NOT NULL,
	`team_id` integer NOT NULL,
	`player_name` text NOT NULL,
	`player_number` text,
	`assist_player_name` text,
	`description` text,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `highlights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`competition` text NOT NULL,
	`thumbnail_url` text NOT NULL,
	`video_url` text NOT NULL,
	`duration` text NOT NULL,
	`published_at` integer DEFAULT (unixepoch()) NOT NULL,
	`home_team_id` integer NOT NULL,
	`away_team_id` integer NOT NULL,
	`home_score` integer DEFAULT 0 NOT NULL,
	`away_score` integer DEFAULT 0 NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`home_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`away_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sport` text DEFAULT 'football' NOT NULL,
	`season` text NOT NULL,
	`logo_url` text,
	`description` text,
	`active` integer DEFAULT true NOT NULL,
	`format` text DEFAULT 'league' NOT NULL,
	`single_group_format` text,
	`color` text,
	`qualification_zones` text
);
--> statement-breakpoint
CREATE TABLE `lineups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`player_number` text NOT NULL,
	`player_name` text NOT NULL,
	`position` text,
	`role` text DEFAULT 'player' NOT NULL,
	`is_starting` integer DEFAULT true NOT NULL,
	`photo_url` text,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `squads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`player_number` text DEFAULT '' NOT NULL,
	`player_name` text NOT NULL,
	`position` text,
	`role` text DEFAULT 'player' NOT NULL,
	`is_starting` integer DEFAULT true NOT NULL,
	`photo_url` text,
	`nationality` text,
	`bio` text,
	`player_code` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `banners` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`image_url` text NOT NULL,
	`link_url` text DEFAULT '' NOT NULL,
	`position` text DEFAULT 'top_home' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_email_unique` ON `admin_users` (`email`);--> statement-breakpoint
CREATE TABLE `spotlights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`image_url` text NOT NULL,
	`link_url` text,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE TABLE `trophies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`title` text NOT NULL,
	`season` text,
	`image_url` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
