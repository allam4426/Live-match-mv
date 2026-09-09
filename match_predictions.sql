CREATE TABLE IF NOT EXISTS match_predictions (
    id serial PRIMARY KEY,
    match_id integer NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    visitor_id text NOT NULL,
    home_score integer NOT NULL,
    away_score integer NOT NULL,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT match_predictions_match_visitor_unique UNIQUE (match_id, visitor_id)
    );
    