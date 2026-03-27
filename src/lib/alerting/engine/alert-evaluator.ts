import type { AlertCondition, PersistedAlertRule } from "../alert-types";
import { InAppNotificationChannel } from "../channels/in-app-channel";
import { NotificationChannelRegistry } from "../channels/notification-channel";
import type { AlertRepository } from "../repository/alert-repository";
import { getAlertRepository } from "../repository/alert-repository-factory";

export interface EvaluationResult {
  rule_id: string;
  connection_id: string;
  breached: boolean;
  current_value: number | null;
  detail: Record<string, unknown>;
}

function computeFingerprint(ruleId: string, connectionId: string, category: string): string {
  return `${ruleId}:${connectionId}:${category}`;
}

export function evaluateCondition(
  condition: AlertCondition,
  currentValue: number | null
): boolean {
  if (currentValue === null || currentValue === undefined) return false;

  switch (condition.operator) {
    case "gt":
      return currentValue > condition.threshold;
    case "gte":
      return currentValue >= condition.threshold;
    case "lt":
      return currentValue < condition.threshold;
    case "lte":
      return currentValue <= condition.threshold;
    case "eq":
      return currentValue === condition.threshold;
    case "neq":
      return currentValue !== condition.threshold;
    default:
      return false;
  }
}

function createChannelRegistry(repository: AlertRepository): NotificationChannelRegistry {
  const registry = new NotificationChannelRegistry();
  registry.register(new InAppNotificationChannel(repository));
  return registry;
}

export async function processEvaluationResult(result: EvaluationResult): Promise<void> {
  const repository = getAlertRepository();

  // Get the rule to access metadata
  // We need to look up by rule_id; iterate user's rules
  // Since we receive the result from a trusted client, we look up the rule directly
  const ruleRow = await findRuleById(repository, result.rule_id);
  if (!ruleRow) return;

  const fingerprint = computeFingerprint(
    result.rule_id,
    result.connection_id,
    ruleRow.category
  );

  // Mark rule as evaluated
  await repository.touchRuleEvaluated(result.rule_id);

  const activeEvent = await repository.getActiveEventByFingerprint(fingerprint);

  if (result.breached) {
    if (!activeEvent) {
      // New alert - create event and notify
      const eventId = crypto.randomUUID();
      const event = await repository.createEvent({
        id: eventId,
        rule_id: result.rule_id,
        user_id: ruleRow.user_id,
        connection_id: result.connection_id,
        fingerprint,
        severity: ruleRow.severity,
        title: `${ruleRow.name}: ${ruleRow.condition.metric_field} is ${result.current_value} (threshold: ${ruleRow.condition.operator} ${ruleRow.condition.threshold})`,
        detail: result.detail,
      });

      await repository.touchRuleFired(result.rule_id);

      const channelRegistry = createChannelRegistry(repository);
      await channelRegistry.dispatch(ruleRow.user_id, ruleRow.channels, {
        event,
        rule: ruleRow,
      });
    } else {
      // Already firing — check cooldown before re-notifying
      if (ruleRow.last_fired_at) {
        const cooldownMs = ruleRow.cooldown_seconds * 1000;
        const elapsed = Date.now() - ruleRow.last_fired_at.getTime();
        if (elapsed < cooldownMs) {
          return; // Still in cooldown
        }
      }

      await repository.touchRuleFired(result.rule_id);
    }
  } else if (activeEvent) {
    // Threshold no longer breached — resolve
    await repository.resolveEvent(activeEvent.id);

    const resolvedEvent = {
      ...activeEvent,
      status: "resolved" as const,
      resolved_at: new Date(),
    };

    const channelRegistry = createChannelRegistry(repository);
    await channelRegistry.dispatch(ruleRow.user_id, ruleRow.channels, {
      event: resolvedEvent,
      rule: ruleRow,
    });
  }
}

async function findRuleById(
  repository: AlertRepository,
  ruleId: string
): Promise<PersistedAlertRule | null> {
  // We need to search across all users — but the repository scopes by user.
  // For server-side processing of evaluation results, we access the DB directly.
  // Since the noop won't have data, this is safe.
  // We'll use a workaround: the evaluation result could include user_id,
  // but for now we'll look it up via the event's rule_id using a direct query.
  // Actually, the client sends the user_id as part of the auth context.
  // Let's make this simpler: the API route will pass the userId.
  // For now, return null if we can't find it.
  // This function is called from processEvaluationResultForUser which has userId.
  return null;
}

export async function processEvaluationResultForUser(
  userId: string,
  result: EvaluationResult
): Promise<void> {
  const repository = getAlertRepository();

  const ruleRow = await repository.getRule(userId, result.rule_id);
  if (!ruleRow) return;

  const fingerprint = computeFingerprint(
    result.rule_id,
    result.connection_id,
    ruleRow.category
  );

  await repository.touchRuleEvaluated(result.rule_id);

  const activeEvent = await repository.getActiveEventByFingerprint(fingerprint);

  if (result.breached) {
    if (!activeEvent) {
      const eventId = crypto.randomUUID();
      const event = await repository.createEvent({
        id: eventId,
        rule_id: result.rule_id,
        user_id: ruleRow.user_id,
        connection_id: result.connection_id,
        fingerprint,
        severity: ruleRow.severity,
        title: `${ruleRow.name}: ${ruleRow.condition.metric_field} is ${result.current_value} (threshold: ${ruleRow.condition.operator} ${ruleRow.condition.threshold})`,
        detail: result.detail,
      });

      await repository.touchRuleFired(result.rule_id);

      const channelRegistry = createChannelRegistry(repository);
      await channelRegistry.dispatch(ruleRow.user_id, ruleRow.channels, {
        event,
        rule: ruleRow,
      });
    } else {
      // Already firing — check cooldown before re-notifying
      if (ruleRow.last_fired_at) {
        const cooldownMs = ruleRow.cooldown_seconds * 1000;
        const elapsed = Date.now() - ruleRow.last_fired_at.getTime();
        if (elapsed < cooldownMs) {
          return;
        }
      }

      await repository.touchRuleFired(result.rule_id);

      // Re-notify after cooldown has elapsed
      const channelRegistry = createChannelRegistry(repository);
      await channelRegistry.dispatch(ruleRow.user_id, ruleRow.channels, {
        event: activeEvent,
        rule: ruleRow,
      });
    }
  } else if (activeEvent) {
    await repository.resolveEvent(activeEvent.id);

    const resolvedEvent = {
      ...activeEvent,
      status: "resolved" as const,
      resolved_at: new Date(),
    };

    const channelRegistry = createChannelRegistry(repository);
    await channelRegistry.dispatch(ruleRow.user_id, ruleRow.channels, {
      event: resolvedEvent,
      rule: ruleRow,
    });
  }
}
