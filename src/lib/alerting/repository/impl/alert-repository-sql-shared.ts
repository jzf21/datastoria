import type { Knex } from "knex";
import type {
  AlertCondition,
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

type SqlRepositoryOptions = {
  getDb: () => Knex;
  nowExpression: string;
  supportsForUpdate: boolean;
  ensureReady?: () => Promise<void>;
};

// Raw DB row types before deserialization
type AlertRuleRow = Omit<PersistedAlertRule, "condition" | "channels" | "enabled"> & {
  condition_text: string;
  channels_text: string | null;
  enabled: number | boolean;
};

type AlertEventRow = Omit<PersistedAlertEvent, "detail"> & {
  detail_text: string | null;
};

type AlertNotificationRow = Omit<PersistedAlertNotification, "is_read" | "is_dismissed"> & {
  is_read: number | boolean;
  is_dismissed: number | boolean;
};

export abstract class AbstractAlertRepository implements AlertRepository {
  constructor(private readonly options: SqlRepositoryOptions) {}

  private db(): Knex {
    return this.options.getDb();
  }

  private nowRaw(executor: Knex | Knex.Transaction): Knex.Raw {
    return executor.raw(this.options.nowExpression);
  }

  private async ensureReady(): Promise<void> {
    if (this.options.ensureReady) {
      await this.options.ensureReady();
    }
  }

  private toPersistedRule(row: AlertRuleRow): PersistedAlertRule {
    return {
      id: row.id,
      user_id: row.user_id,
      connection_id: row.connection_id,
      name: row.name,
      description: row.description,
      rule_type: row.rule_type,
      category: row.category,
      severity: row.severity,
      enabled: Boolean(row.enabled),
      condition: JSON.parse(row.condition_text) as AlertCondition,
      evaluation_interval_seconds: row.evaluation_interval_seconds,
      cooldown_seconds: row.cooldown_seconds,
      channels: row.channels_text
        ? (JSON.parse(row.channels_text) as NotificationChannel[])
        : ["in_app"],
      last_evaluated_at: row.last_evaluated_at ? new Date(row.last_evaluated_at) : null,
      last_fired_at: row.last_fired_at ? new Date(row.last_fired_at) : null,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  private toPersistedEvent(row: AlertEventRow): PersistedAlertEvent {
    return {
      id: row.id,
      rule_id: row.rule_id,
      user_id: row.user_id,
      connection_id: row.connection_id,
      fingerprint: row.fingerprint,
      severity: row.severity,
      status: row.status,
      title: row.title,
      detail: row.detail_text ? (JSON.parse(row.detail_text) as Record<string, unknown>) : null,
      fired_at: new Date(row.fired_at),
      resolved_at: row.resolved_at ? new Date(row.resolved_at) : null,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  private toPersistedNotification(
    row: AlertNotificationRow
  ): PersistedAlertNotification {
    return {
      id: row.id,
      event_id: row.event_id,
      user_id: row.user_id,
      channel: row.channel,
      is_read: Boolean(row.is_read),
      is_dismissed: Boolean(row.is_dismissed),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  // ── Rules ──

  async listRules(userId: string): Promise<PersistedAlertRule[]> {
    await this.ensureReady();
    const rows = (await this.db()("alert_rules")
      .select("*")
      .where({ user_id: userId })
      .orderBy("created_at", "asc")) as AlertRuleRow[];
    return rows.map((row) => this.toPersistedRule(row));
  }

  async getRule(userId: string, ruleId: string): Promise<PersistedAlertRule | null> {
    await this.ensureReady();
    const row = (await this.db()("alert_rules")
      .select("*")
      .where({ id: ruleId, user_id: userId })
      .first()) as AlertRuleRow | undefined;
    return row ? this.toPersistedRule(row) : null;
  }

  async getEnabledRulesDueForEvaluation(
    userId: string,
    connectionId: string
  ): Promise<PersistedAlertRule[]> {
    await this.ensureReady();
    const db = this.db();

    const rows = (await db("alert_rules")
      .select("*")
      .where({ user_id: userId, enabled: true })
      .andWhere(function () {
        this.whereNull("connection_id").orWhere({ connection_id: connectionId });
      })
      .andWhere(function () {
        this.whereNull("last_evaluated_at").orWhereRaw(
          `last_evaluated_at < ${db.client.config.client === "better-sqlite3" ? "DATETIME('now', '-' || evaluation_interval_seconds || ' seconds')" : db.client.config.client === "pg" ? "(CURRENT_TIMESTAMP - (evaluation_interval_seconds || ' seconds')::interval)" : "DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL evaluation_interval_seconds SECOND)"}`
        );
      })
      .orderBy("created_at", "asc")) as AlertRuleRow[];

    return rows.map((row) => this.toPersistedRule(row));
  }

  async createRule(input: CreateAlertRuleInput): Promise<PersistedAlertRule> {
    await this.ensureReady();
    await this.db()("alert_rules").insert({
      id: input.id,
      user_id: input.user_id,
      connection_id: input.connection_id ?? null,
      name: input.name,
      description: input.description ?? null,
      rule_type: input.rule_type,
      category: input.category,
      severity: input.severity,
      enabled: input.enabled ?? true,
      condition_text: JSON.stringify(input.condition),
      evaluation_interval_seconds: input.evaluation_interval_seconds ?? 300,
      cooldown_seconds: input.cooldown_seconds ?? 900,
      channels_text: input.channels ? JSON.stringify(input.channels) : null,
      created_at: this.nowRaw(this.db()),
      updated_at: this.nowRaw(this.db()),
    });

    const created = await this.getRule(input.user_id, input.id);
    if (!created) {
      throw new Error("Failed to create alert rule");
    }
    return created;
  }

  async updateRule(input: UpdateAlertRuleInput): Promise<PersistedAlertRule | null> {
    await this.ensureReady();
    const updates: Record<string, unknown> = {
      updated_at: this.nowRaw(this.db()),
    };
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.severity !== undefined) updates.severity = input.severity;
    if (input.enabled !== undefined) updates.enabled = input.enabled;
    if (input.condition !== undefined) updates.condition_text = JSON.stringify(input.condition);
    if (input.evaluation_interval_seconds !== undefined)
      updates.evaluation_interval_seconds = input.evaluation_interval_seconds;
    if (input.cooldown_seconds !== undefined) updates.cooldown_seconds = input.cooldown_seconds;
    if (input.channels !== undefined) updates.channels_text = JSON.stringify(input.channels);

    await this.db()("alert_rules").where({ id: input.id, user_id: input.user_id }).update(updates);
    return this.getRule(input.user_id, input.id);
  }

  async deleteRule(userId: string, ruleId: string): Promise<void> {
    await this.ensureReady();
    await this.db().transaction(async (trx) => {
      // Delete notifications linked to events of this rule
      const eventIds = trx("alert_events").select("id").where({ rule_id: ruleId });
      await trx("alert_notifications").whereIn("event_id", eventIds).del();
      await trx("alert_events").where({ rule_id: ruleId }).del();
      await trx("alert_rules").where({ id: ruleId, user_id: userId }).del();
    });
  }

  async touchRuleEvaluated(ruleId: string): Promise<void> {
    await this.ensureReady();
    await this.db()("alert_rules")
      .where({ id: ruleId })
      .update({ last_evaluated_at: this.nowRaw(this.db()), updated_at: this.nowRaw(this.db()) });
  }

  async touchRuleFired(ruleId: string): Promise<void> {
    await this.ensureReady();
    await this.db()("alert_rules")
      .where({ id: ruleId })
      .update({ last_fired_at: this.nowRaw(this.db()), updated_at: this.nowRaw(this.db()) });
  }

  // ── Events ──

  async listEvents(userId: string, options?: ListEventsOptions): Promise<PersistedAlertEvent[]> {
    await this.ensureReady();
    const query = this.db()("alert_events")
      .select("*")
      .where({ user_id: userId })
      .orderBy("fired_at", "desc");

    if (options?.status) {
      query.andWhere({ status: options.status });
    }
    if (options?.limit) {
      query.limit(options.limit);
    }

    const rows = (await query) as AlertEventRow[];
    return rows.map((row) => this.toPersistedEvent(row));
  }

  async getActiveEventByFingerprint(fingerprint: string): Promise<PersistedAlertEvent | null> {
    await this.ensureReady();
    const row = (await this.db()("alert_events")
      .select("*")
      .where({ fingerprint, status: "firing" })
      .first()) as AlertEventRow | undefined;
    return row ? this.toPersistedEvent(row) : null;
  }

  async createEvent(input: CreateAlertEventInput): Promise<PersistedAlertEvent> {
    await this.ensureReady();
    await this.db()("alert_events").insert({
      id: input.id,
      rule_id: input.rule_id,
      user_id: input.user_id,
      connection_id: input.connection_id ?? null,
      fingerprint: input.fingerprint,
      severity: input.severity,
      status: "firing",
      title: input.title,
      detail_text: input.detail ? JSON.stringify(input.detail) : null,
      fired_at: this.nowRaw(this.db()),
      created_at: this.nowRaw(this.db()),
      updated_at: this.nowRaw(this.db()),
    });

    const row = (await this.db()("alert_events")
      .select("*")
      .where({ id: input.id })
      .first()) as AlertEventRow | undefined;
    if (!row) {
      throw new Error("Failed to create alert event");
    }
    return this.toPersistedEvent(row);
  }

  async resolveEvent(eventId: string): Promise<void> {
    await this.ensureReady();
    await this.db()("alert_events")
      .where({ id: eventId })
      .update({
        status: "resolved",
        resolved_at: this.nowRaw(this.db()),
        updated_at: this.nowRaw(this.db()),
      });
  }

  async acknowledgeEvent(userId: string, eventId: string): Promise<void> {
    await this.ensureReady();
    await this.db()("alert_events")
      .where({ id: eventId, user_id: userId })
      .update({ status: "acknowledged", updated_at: this.nowRaw(this.db()) });
  }

  // ── Notifications ──

  async listNotifications(
    userId: string,
    options?: ListNotificationsOptions
  ): Promise<(PersistedAlertNotification & { event?: PersistedAlertEvent })[]> {
    await this.ensureReady();

    const query = this.db()("alert_notifications as n")
      .leftJoin("alert_events as e", "n.event_id", "e.id")
      .select(
        "n.id",
        "n.event_id",
        "n.user_id",
        "n.channel",
        "n.is_read",
        "n.is_dismissed",
        "n.created_at",
        "n.updated_at",
        "e.id as event__id",
        "e.rule_id as event__rule_id",
        "e.user_id as event__user_id",
        "e.connection_id as event__connection_id",
        "e.fingerprint as event__fingerprint",
        "e.severity as event__severity",
        "e.status as event__status",
        "e.title as event__title",
        "e.detail_text as event__detail_text",
        "e.fired_at as event__fired_at",
        "e.resolved_at as event__resolved_at"
      )
      .where("n.user_id", userId)
      .andWhere("n.is_dismissed", false)
      .orderBy("n.created_at", "desc");

    if (options?.unreadOnly) {
      query.andWhere("n.is_read", false);
    }
    if (options?.limit) {
      query.limit(options.limit);
    }

    const rows = await query;
    return rows.map((row: Record<string, unknown>) => {
      const notification = this.toPersistedNotification({
        id: row.id as string,
        event_id: row.event_id as string,
        user_id: row.user_id as string,
        channel: row.channel as NotificationChannel,
        is_read: row.is_read as number | boolean,
        is_dismissed: row.is_dismissed as number | boolean,
        created_at: row.created_at as Date,
        updated_at: row.updated_at as Date,
      });

      const event = row["event__id"]
        ? this.toPersistedEvent({
            id: row["event__id"] as string,
            rule_id: row["event__rule_id"] as string,
            user_id: row["event__user_id"] as string,
            connection_id: (row["event__connection_id"] as string | null),
            fingerprint: row["event__fingerprint"] as string,
            severity: row["event__severity"] as PersistedAlertEvent["severity"],
            status: row["event__status"] as PersistedAlertEvent["status"],
            title: row["event__title"] as string,
            detail_text: row["event__detail_text"] as string | null,
            fired_at: row["event__fired_at"] as Date,
            resolved_at: (row["event__resolved_at"] as Date | null),
            created_at: row["event__fired_at"] as Date,
            updated_at: row["event__fired_at"] as Date,
          })
        : undefined;

      return { ...notification, event };
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    await this.ensureReady();
    const result = await this.db()("alert_notifications")
      .where({ user_id: userId, is_read: false, is_dismissed: false })
      .count("* as count")
      .first();
    return Number(result?.count ?? 0);
  }

  async createNotification(
    eventId: string,
    userId: string,
    channel: NotificationChannel
  ): Promise<PersistedAlertNotification> {
    await this.ensureReady();
    const id = crypto.randomUUID();
    await this.db()("alert_notifications").insert({
      id,
      event_id: eventId,
      user_id: userId,
      channel,
      is_read: false,
      is_dismissed: false,
      created_at: this.nowRaw(this.db()),
      updated_at: this.nowRaw(this.db()),
    });

    const row = (await this.db()("alert_notifications")
      .select("*")
      .where({ id })
      .first()) as AlertNotificationRow | undefined;
    if (!row) {
      throw new Error("Failed to create alert notification");
    }
    return this.toPersistedNotification(row);
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.ensureReady();
    await this.db()("alert_notifications")
      .where({ id: notificationId, user_id: userId })
      .update({ is_read: true, updated_at: this.nowRaw(this.db()) });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.ensureReady();
    await this.db()("alert_notifications")
      .where({ user_id: userId, is_read: false })
      .update({ is_read: true, updated_at: this.nowRaw(this.db()) });
  }

  async dismissNotification(userId: string, notificationId: string): Promise<void> {
    await this.ensureReady();
    await this.db()("alert_notifications")
      .where({ id: notificationId, user_id: userId })
      .update({ is_dismissed: true, updated_at: this.nowRaw(this.db()) });
  }

  // ── Cleanup ──

  async cleanupOldEvents(cutoff: Date): Promise<number> {
    await this.ensureReady();
    return this.db().transaction(async (trx) => {
      const expiredEventIds = trx("alert_events").select("id").where("created_at", "<", cutoff);
      await trx("alert_notifications").whereIn("event_id", expiredEventIds).del();
      const deletedCount = await trx("alert_events").where("created_at", "<", cutoff).del();
      return deletedCount;
    });
  }
}
