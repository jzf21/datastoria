import { getAuthenticatedUserEmail } from "@/auth";
import { getAlertRepository } from "@/lib/alerting/repository/alert-repository-factory";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = getAuthenticatedUserEmail(req) ?? "anonymous";

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread_only") === "true";
  const limitStr = url.searchParams.get("limit");
  const limit = limitStr ? Number.parseInt(limitStr, 10) : undefined;

  try {
    const notifications = await getAlertRepository().listNotifications(userId, {
      unreadOnly,
      limit: limit && limit > 0 ? limit : 50,
    });
    return NextResponse.json(notifications);
  } catch (err) {
    console.error("[/api/alerts/notifications] Failed to list notifications", err);
    return NextResponse.json({ error: "Failed to list notifications" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const userId = getAuthenticatedUserEmail(req) ?? "anonymous";

  try {
    await getAlertRepository().markAllAsRead(userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/alerts/notifications] Failed to mark all as read", err);
    return NextResponse.json({ error: "Failed to mark all as read" }, { status: 500 });
  }
}
