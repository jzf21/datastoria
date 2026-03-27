import type { AlertRepository } from "../repository/alert-repository";
import type { NotificationChannelHandler, NotificationPayload } from "./notification-channel";

export class InAppNotificationChannel implements NotificationChannelHandler {
  readonly channelType = "in_app" as const;

  constructor(private readonly repository: AlertRepository) {}

  async send(userId: string, payload: NotificationPayload): Promise<void> {
    await this.repository.createNotification(payload.event.id, userId, "in_app");
  }
}
