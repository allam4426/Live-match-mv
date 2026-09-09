CREATE TABLE IF NOT EXISTS match_predictions (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    match_id integer NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    visitor_id text NOT NULL,
    home_score integer NOT NULL,
    away_score integer NOT NULL,
    created_at integer NOT NULL DEFAULT (unixepoch()),
    updated_at integer NOT NULL DEFAULT (unixepoch())
    );
    --> statement-breakpoint
    CREATE UNIQUE INDEX IF NOT EXISTS match_predictions_match_visitor_unique ON match_predictions (match_id, visitor_id);
    