-- Security hardening: audit_log indexes (avoid full-table scans) + server-side token revocation
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_action_time ON audit_log (actor, action, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at);
ALTER TABLE teachers ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE students ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;
