import type { NotificationChannel, PersistedAlertEvent, PersistedAlertRule } from "../alert-types";

export interface NotificationPayload {
  event: PersistedAlertEvent;
  rule: PersistedAlertRule;
}

export interface NotificationChannelHandler {
  readonly channelType: NotificationChannel;
  send(userId: string, payload: NotificationPayload): Promise<void>;
}

export class NotificationChannelRegistry {
  private handlers = new Map<NotificationChannel, NotificationChannelHandler>();

  register(handler: NotificationChannelHandler): void {
    this.handlers.set(handler.channelType, handler);
  }

  async dispatch(
    userId: string,
    channels: NotificationChannel[],
    payload: NotificationPayload
  ): Promise<void> {
    for (const channel of channels) {
      const handler = this.handlers.get(channel);
      if (handler) {
        await handler.send(userId, payload);
      }
    }
  }
}
