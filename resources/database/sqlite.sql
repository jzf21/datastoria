CREATE TABLE IF NOT EXISTS chat_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  title TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'))
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_connection
  ON chat_sessions (user_id, connection_id);

CREATE UNIQUE INDEX IF NOT EXISTS uk_chat_sessions_user_connection_session
  ON chat_sessions (user_id, connection_id, session_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  role TEXT NOT NULL,
  parts_text TEXT NOT NULL,
  metadata_text TEXT NULL,
  sequence INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
  UNIQUE (user_id, session_id, message_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_session
  ON chat_messages (user_id, session_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_session_sequence
  ON chat_messages (user_id, session_id, sequence);

CREATE TABLE IF NOT EXISTS ai_skills (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  skill_id TEXT NULL,
  meta TEXT NULL,
  content TEXT NOT NULL,
  state TEXT NOT NULL,
  scope TEXT NOT NULL,
  version TEXT NULL,
  owner_id TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'))
);

CREATE INDEX IF NOT EXISTS idx_ai_skills_type_state_scope
  ON ai_skills (type, state, scope);

CREATE INDEX IF NOT EXISTS idx_ai_skills_owner_scope
  ON ai_skills (owner_id, scope);

CREATE INDEX IF NOT EXISTS idx_ai_skills_skill_id
  ON ai_skills (skill_id);

CREATE TABLE IF NOT EXISTS feedback_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  session_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  solved INTEGER NOT NULL,
  reason_code TEXT NULL,
  payload_text TEXT NOT NULL,
  free_text TEXT NULL,
  recovery_action_taken INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
  UNIQUE (user_id, source, message_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_events_source_created_at
  ON feedback_events (source, created_at);

CREATE INDEX IF NOT EXISTS idx_feedback_events_message
  ON feedback_events (user_id, session_id, message_id);

CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  connection_id TEXT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  rule_type TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'WARNING',
  enabled INTEGER NOT NULL DEFAULT 1,
  condition_text TEXT NOT NULL,
  evaluation_interval_seconds INTEGER NOT NULL DEFAULT 300,
  cooldown_seconds INTEGER NOT NULL DEFAULT 900,
  channels_text TEXT NULL,
  last_evaluated_at TEXT NULL,
  last_fired_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'))
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_user_enabled
  ON alert_rules (user_id, enabled);

CREATE INDEX IF NOT EXISTS idx_alert_rules_category
  ON alert_rules (category);

CREATE TABLE IF NOT EXISTS alert_events (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  connection_id TEXT NULL,
  fingerprint TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'firing',
  title TEXT NOT NULL,
  detail_text TEXT NULL,
  fired_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
  resolved_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'))
);

CREATE INDEX IF NOT EXISTS idx_alert_events_rule
  ON alert_events (rule_id);

CREATE INDEX IF NOT EXISTS idx_alert_events_user_status
  ON alert_events (user_id, status);

CREATE INDEX IF NOT EXISTS idx_alert_events_fingerprint
  ON alert_events (fingerprint, status);

CREATE INDEX IF NOT EXISTS idx_alert_events_fired_at
  ON alert_events (user_id, fired_at);

CREATE TABLE IF NOT EXISTS alert_notifications (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'in_app',
  is_read INTEGER NOT NULL DEFAULT 0,
  is_dismissed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'))
);

CREATE INDEX IF NOT EXISTS idx_alert_notifications_user_read
  ON alert_notifications (user_id, is_read, is_dismissed);

CREATE INDEX IF NOT EXISTS idx_alert_notifications_event
  ON alert_notifications (event_id);
