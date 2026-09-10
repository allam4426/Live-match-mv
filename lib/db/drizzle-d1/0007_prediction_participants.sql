CREATE TABLE IF NOT EXISTS prediction_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (tournament_id, user_id)
);
CREATE INDEX IF NOT EXISTS prediction_participants_tournament_idx ON prediction_participants(tournament_id);
CREATE INDEX IF NOT EXISTS prediction_participants_user_idx ON prediction_participants(user_id);
