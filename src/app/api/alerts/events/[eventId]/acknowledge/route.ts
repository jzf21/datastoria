import { getAuthenticatedUserEmail } from "@/auth";
import { getAlertRepository } from "@/lib/alerting/repository/alert-repository-factory";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ eventId: string }> };

export async function POST(req: Request, context: RouteContext) {
  const userId = getAuthenticatedUserEmail(req) ?? "anonymous";

  const { eventId } = await context.params;
  try {
    await getAlertRepository().acknowledgeEvent(userId, eventId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/alerts/events/[eventId]/acknowledge] Failed to acknowledge event", err);
    return NextResponse.json({ error: "Failed to acknowledge event" }, { status: 500 });
  }
}
