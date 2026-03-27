CREATE TABLE IF NOT EXISTS chat_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  connection_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  title TEXT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_connection
  ON chat_sessions (user_id, connection_id);

CREATE UNIQUE INDEX IF NOT EXISTS uk_chat_sessions_user_connection_session
  ON chat_sessions (user_id, connection_id, session_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  message_id VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL,
  parts_text TEXT NOT NULL,
  metadata_text TEXT NULL,
  sequence INT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE (user_id, session_id, message_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_session
  ON chat_messages (user_id, session_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_session_sequence
  ON chat_messages (user_id, session_id, sequence);

CREATE TABLE IF NOT EXISTS ai_skills (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(32) NOT NULL,
  skill_id VARCHAR(255) NULL,
  meta TEXT NULL,
  content TEXT NOT NULL,
  state VARCHAR(32) NOT NULL,
  scope VARCHAR(32) NOT NULL,
  version VARCHAR(255) NULL,
  owner_id VARCHAR(255) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS idx_ai_skills_type_state_scope
  ON ai_skills (type, state, scope);

CREATE INDEX IF NOT EXISTS idx_ai_skills_owner_scope
  ON ai_skills (owner_id, scope);

CREATE INDEX IF NOT EXISTS idx_ai_skills_skill_id
  ON ai_skills (skill_id);

CREATE TABLE IF NOT EXISTS feedback_events (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  source VARCHAR(128) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  message_id VARCHAR(255) NOT NULL,
  solved BOOLEAN NOT NULL,
  reason_code VARCHAR(128) NULL,
  payload_text TEXT NOT NULL,
  free_text TEXT NULL,
  recovery_action_taken BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE (user_id, source, message_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_events_source_created_at
  ON feedback_events (source, created_at);

CREATE INDEX IF NOT EXISTS idx_feedback_events_message
  ON feedback_events (user_id, session_id, message_id);

CREATE TABLE IF NOT EXISTS alert_rules (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  connection_id VARCHAR(255) NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  rule_type VARCHAR(32) NOT NULL,
  category VARCHAR(64) NOT NULL,
  severity VARCHAR(32) NOT NULL DEFAULT 'WARNING',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  condition_text TEXT NOT NULL,
  evaluation_interval_seconds INT NOT NULL DEFAULT 300,
  cooldown_seconds INT NOT NULL DEFAULT 900,
  channels_text TEXT NULL,
  last_evaluated_at TIMESTAMP(3) NULL,
  last_fired_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_user_enabled
  ON alert_rules (user_id, enabled);

CREATE INDEX IF NOT EXISTS idx_alert_rules_category
  ON alert_rules (category);

CREATE TABLE IF NOT EXISTS alert_events (
  id VARCHAR(255) PRIMARY KEY,
  rule_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  connection_id VARCHAR(255) NULL,
  fingerprint VARCHAR(255) NOT NULL,
  severity VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'firing',
  title TEXT NOT NULL,
  detail_text TEXT NULL,
  fired_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
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
  id VARCHAR(255) PRIMARY KEY,
  event_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  channel VARCHAR(32) NOT NULL DEFAULT 'in_app',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS idx_alert_notifications_user_read
  ON alert_notifications (user_id, is_read, is_dismissed);

CREATE INDEX IF NOT EXISTS idx_alert_notifications_event
  ON alert_notifications (event_id);
