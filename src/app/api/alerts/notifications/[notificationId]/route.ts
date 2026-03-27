import { getAuthenticatedUserEmail } from "@/auth";
import { getAlertRepository } from "@/lib/alerting/repository/alert-repository-factory";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ notificationId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const userId = getAuthenticatedUserEmail(req) ?? "anonymous";

  const { notificationId } = await context.params;
  try {
    await getAlertRepository().markAsRead(userId, notificationId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/alerts/notifications/[notificationId]] Failed to mark as read", err);
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const userId = getAuthenticatedUserEmail(req) ?? "anonymous";

  const { notificationId } = await context.params;
  try {
    await getAlertRepository().dismissNotification(userId, notificationId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/alerts/notifications/[notificationId]] Failed to dismiss", err);
    return NextResponse.json({ error: "Failed to dismiss notification" }, { status: 500 });
  }
}
