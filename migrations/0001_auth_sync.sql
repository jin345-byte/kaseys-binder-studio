PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,google_sub TEXT NOT NULL UNIQUE,email TEXT NOT NULL DEFAULT '',display_name TEXT NOT NULL DEFAULT '',picture_url TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS binder_snapshots (user_id TEXT PRIMARY KEY,payload TEXT NOT NULL,encoding TEXT NOT NULL DEFAULT 'json',updated_at INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 1,FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);