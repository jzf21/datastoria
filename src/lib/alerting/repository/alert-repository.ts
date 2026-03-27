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
} from "../alert-types";

export interface AlertRepository {
  // Rules
  listRules(userId: string): Promise<PersistedAlertRule[]>;
  getRule(userId: string, ruleId: string): Promise<PersistedAlertRule | null>;
  getEnabledRulesDueForEvaluation(userId: string, connectionId: string): Promise<PersistedAlertRule[]>;
  createRule(input: CreateAlertRuleInput): Promise<PersistedAlertRule>;
  updateRule(input: UpdateAlertRuleInput): Promise<PersistedAlertRule | null>;
  deleteRule(userId: string, ruleId: string): Promise<void>;
  touchRuleEvaluated(ruleId: string): Promise<void>;
  touchRuleFired(ruleId: string): Promise<void>;

  // Events
  listEvents(userId: string, options?: ListEventsOptions): Promise<PersistedAlertEvent[]>;
  getActiveEventByFingerprint(fingerprint: string): Promise<PersistedAlertEvent | null>;
  createEvent(input: CreateAlertEventInput): Promise<PersistedAlertEvent>;
  resolveEvent(eventId: string): Promise<void>;
  acknowledgeEvent(userId: string, eventId: string): Promise<void>;

  // Notifications
  listNotifications(
    userId: string,
    options?: ListNotificationsOptions
  ): Promise<(PersistedAlertNotification & { event?: PersistedAlertEvent })[]>;
  getUnreadCount(userId: string): Promise<number>;
  createNotification(
    eventId: string,
    userId: string,
    channel: NotificationChannel
  ): Promise<PersistedAlertNotification>;
  markAsRead(userId: string, notificationId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  dismissNotification(userId: string, notificationId: string): Promise<void>;

  // Cleanup
  cleanupOldEvents(cutoff: Date): Promise<number>;
}
