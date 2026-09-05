CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"logo_url" text DEFAULT '' NOT NULL,
	"country" text NOT NULL,
	"sport" text DEFAULT 'football' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"home_team_id" integer,
	"away_team_id" integer,
	"home_score" integer DEFAULT 0 NOT NULL,
	"away_score" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"minute" text,
	"competition" text NOT NULL,
	"competition_logo" text,
	"kickoff_at" timestamp NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sport" text DEFAULT 'football' NOT NULL,
	"tournament_id" integer,
	"venue" text,
	"match_group" text,
	"clock_anchor_ms" bigint,
	"live_notification_sent" boolean DEFAULT false NOT NULL,
	"finished_notification_sent" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streams" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"quality" text DEFAULT 'HD' NOT NULL,
	"language" text DEFAULT 'EN' NOT NULL,
	"embed_code" text
);
--> statement-breakpoint
CREATE TABLE "match_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"type" text NOT NULL,
	"minute" text NOT NULL,
	"team_id" integer NOT NULL,
	"player_name" text NOT NULL,
	"player_number" text,
	"assist_player_name" text,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "highlights" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"competition" text NOT NULL,
	"thumbnail_url" text NOT NULL,
	"video_url" text NOT NULL,
	"duration" text NOT NULL,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"home_team_id" integer NOT NULL,
	"away_team_id" integer NOT NULL,
	"home_score" integer DEFAULT 0 NOT NULL,
	"away_score" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sport" text DEFAULT 'football' NOT NULL,
	"season" text NOT NULL,
	"logo_url" text,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"format" text DEFAULT 'league' NOT NULL,
	"single_group_format" text,
	"color" text,
	"qualification_zones" json,
	"parent_tournament_id" integer,
	"stage_type" text DEFAULT 'championship'
);
--> statement-breakpoint
CREATE TABLE "lineups" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"player_number" text NOT NULL,
	"player_name" text NOT NULL,
	"position" text,
	"role" text DEFAULT 'player' NOT NULL,
	"is_starting" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "squads" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"player_number" text DEFAULT '' NOT NULL,
	"player_name" text NOT NULL,
	"position" text,
	"role" text DEFAULT 'player' NOT NULL,
	"is_starting" boolean DEFAULT true NOT NULL,
	"photo_url" text,
	"nationality" text,
	"bio" text,
	"player_code" text
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" serial PRIMARY KEY NOT NULL,
	"image_url" text NOT NULL,
	"link_url" text DEFAULT '' NOT NULL,
	"position" text DEFAULT 'top_home' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "spotlights" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"image_url" text NOT NULL,
	"link_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"team_ids" text DEFAULT '[]' NOT NULL,
	"tournament_ids" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "trophies" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"title" text NOT NULL,
	"season" text,
	"image_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streams" ADD CONSTRAINT "streams_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "squads" ADD CONSTRAINT "squads_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trophies" ADD CONSTRAINT "trophies_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;