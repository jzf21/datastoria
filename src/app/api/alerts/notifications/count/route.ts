import { getAuthenticatedUserEmail } from "@/auth";
import { getAlertRepository } from "@/lib/alerting/repository/alert-repository-factory";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = getAuthenticatedUserEmail(req) ?? "anonymous";

  try {
    const count = await getAlertRepository().getUnreadCount(userId);
    return NextResponse.json({ count });
  } catch (err) {
    console.error("[/api/alerts/notifications/count] Failed to get unread count", err);
    return NextResponse.json({ count: 0 });
  }
}
