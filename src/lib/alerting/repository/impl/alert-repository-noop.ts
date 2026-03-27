import type {
  CreateAlertEventInput,
  CreateAlertRuleInput,
  ListEventsOptions,
  ListNotificationsOptions,
  NotificationChannel,
  PersistedAlertEvent,
  PersistedAlertNotification,
  PersistedAlertRule,
  UpdateAlertRuleInput,
} from "../../alert-types";
import type { AlertRepository } from "../alert-repository";

export class AlertRepositoryNoop implements AlertRepository {
  async listRules(_userId: string): Promise<PersistedAlertRule[]> {
    return [];
  }

  async getRule(_userId: string, _ruleId: string): Promise<PersistedAlertRule | null> {
    return null;
  }

  async getEnabledRulesDueForEvaluation(
    _userId: string,
    _connectionId: string
  ): Promise<PersistedAlertRule[]> {
    return [];
  }

  async createRule(input: CreateAlertRuleInput): Promise<PersistedAlertRule> {
    const now = new Date();
    return {
      id: input.id,
      user_id: input.user_id,
      connection_id: input.connection_id ?? null,
      name: input.name,
      description: input.description ?? null,
      rule_type: input.rule_type,
      category: input.category,
      severity: input.severity,
      enabled: input.enabled ?? true,
      condition: input.condition,
      evaluation_interval_seconds: input.evaluation_interval_seconds ?? 300,
      cooldown_seconds: input.cooldown_seconds ?? 900,
      channels: input.channels ?? ["in_app"],
      last_evaluated_at: null,
      last_fired_at: null,
      created_at: now,
      updated_at: now,
    };
  }

  async updateRule(_input: UpdateAlertRuleInput): Promise<PersistedAlertRule | null> {
    return null;
  }

  async deleteRule(_userId: string, _ruleId: string): Promise<void> {}

  async touchRuleEvaluated(_ruleId: string): Promise<void> {}

  async touchRuleFired(_ruleId: string): Promise<void> {}

  async listEvents(
    _userId: string,
    _options?: ListEventsOptions
  ): Promise<PersistedAlertEvent[]> {
    return [];
  }

  async getActiveEventByFingerprint(
    _fingerprint: string
  ): Promise<PersistedAlertEvent | null> {
    return null;
  }

  async createEvent(input: CreateAlertEventInput): Promise<PersistedAlertEvent> {
    const now = new Date();
    return {
      id: input.id,
      rule_id: input.rule_id,
      user_id: input.user_id,
      connection_id: input.connection_id ?? null,
      fingerprint: input.fingerprint,
      severity: input.severity,
      status: "firing",
      title: input.title,
      detail: input.detail ?? null,
      fired_at: now,
      resolved_at: null,
      created_at: now,
      updated_at: now,
    };
  }

  async resolveEvent(_eventId: string): Promise<void> {}

  async acknowledgeEvent(_userId: string, _eventId: string): Promise<void> {}

  async listNotifications(
    _userId: string,
    _options?: ListNotificationsOptions
  ): Promise<(PersistedAlertNotification & { event?: PersistedAlertEvent })[]> {
    return [];
  }

  async getUnreadCount(_userId: string): Promise<number> {
    return 0;
  }

  async createNotification(
    _eventId: string,
    userId: string,
    channel: NotificationChannel
  ): Promise<PersistedAlertNotification> {
    const now = new Date();
    return {
      id: crypto.randomUUID(),
      event_id: _eventId,
      user_id: userId,
      channel,
      is_read: false,
      is_dismissed: false,
      created_at: now,
      updated_at: now,
    };
  }

  async markAsRead(_userId: string, _notificationId: string): Promise<void> {}

  async markAllAsRead(_userId: string): Promise<void> {}

  async dismissNotification(_userId: string, _notificationId: string): Promise<void> {}

  async cleanupOldEvents(_cutoff: Date): Promise<number> {
    return 0;
  }
}
