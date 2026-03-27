import { getAuthenticatedUserEmail } from "@/auth";
import type { AlertStatus } from "@/lib/alerting/alert-types";
import { getAlertRepository } from "@/lib/alerting/repository/alert-repository-factory";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = getAuthenticatedUserEmail(req) ?? "anonymous";

  const url = new URL(req.url);
  const status = url.searchParams.get("status") as AlertStatus | null;
  const limitStr = url.searchParams.get("limit");
  const limit = limitStr ? Number.parseInt(limitStr, 10) : undefined;

  try {
    const events = await getAlertRepository().listEvents(userId, {
      status: status ?? undefined,
      limit: limit && limit > 0 ? limit : undefined,
    });
    return NextResponse.json(events);
  } catch (err) {
    console.error("[/api/alerts/events] Failed to list events", err);
    return NextResponse.json({ error: "Failed to list events" }, { status: 500 });
  }
}
