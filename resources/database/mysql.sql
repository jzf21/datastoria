CREATE TABLE chat_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  connection_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  title TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_chat_sessions_user_connection_session (user_id, connection_id, session_id),
  KEY idx_chat_sessions_user_connection (user_id, connection_id)
);

CREATE TABLE chat_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  message_id VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL,
  parts_text LONGTEXT NOT NULL,
  metadata_text LONGTEXT NULL,
  sequence INT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_chat_messages_user_session (user_id, session_id),
  KEY idx_chat_messages_user_session_sequence (user_id, session_id, sequence),
  UNIQUE KEY uk_chat_messages_user_session_message_sequence (user_id, session_id, message_id, sequence)
);

CREATE TABLE ai_skills (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  type VARCHAR(32) NOT NULL,
  skill_id VARCHAR(255) NULL,
  meta LONGTEXT NULL,
  content LONGTEXT NOT NULL,
  state VARCHAR(32) NOT NULL,
  scope VARCHAR(32) NOT NULL,
  version VARCHAR(255) NULL,
  owner_id VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_ai_skills_type_state_scope (type, state, scope),
  KEY idx_ai_skills_owner_scope (owner_id, scope),
  KEY idx_ai_skills_skill_id (skill_id)
);

CREATE TABLE IF NOT EXISTS feedback_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  source VARCHAR(128) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  message_id VARCHAR(255) NOT NULL,
  solved BOOLEAN NOT NULL,
  reason_code VARCHAR(128) NULL,
  payload_text LONGTEXT NOT NULL,
  free_text LONGTEXT NULL,
  recovery_action_taken BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_feedback_events_user_source_message (user_id, source, message_id),
  KEY idx_feedback_events_source_created_at (source, created_at),
  KEY idx_feedback_events_message (user_id, session_id, message_id)
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  connection_id VARCHAR(255) NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  rule_type VARCHAR(32) NOT NULL,
  category VARCHAR(64) NOT NULL,
  severity VARCHAR(32) NOT NULL DEFAULT 'WARNING',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  condition_text LONGTEXT NOT NULL,
  evaluation_interval_seconds INT NOT NULL DEFAULT 300,
  cooldown_seconds INT NOT NULL DEFAULT 900,
  channels_text LONGTEXT NULL,
  last_evaluated_at DATETIME(3) NULL,
  last_fired_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_alert_rules_user_enabled (user_id, enabled),
  KEY idx_alert_rules_category (category)
);

CREATE TABLE IF NOT EXISTS alert_events (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  rule_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  connection_id VARCHAR(255) NULL,
  fingerprint VARCHAR(255) NOT NULL,
  severity VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'firing',
  title TEXT NOT NULL,
  detail_text LONGTEXT NULL,
  fired_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_alert_events_rule (rule_id),
  KEY idx_alert_events_user_status (user_id, status),
  KEY idx_alert_events_fingerprint (fingerprint, status),
  KEY idx_alert_events_fired_at (user_id, fired_at)
);

CREATE TABLE IF NOT EXISTS alert_notifications (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  event_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  channel VARCHAR(32) NOT NULL DEFAULT 'in_app',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_alert_notifications_user_read (user_id, is_read, is_dismissed),
  KEY idx_alert_notifications_event (event_id)
);
