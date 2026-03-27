import { getAuthenticatedUserEmail } from "@/auth";
import { getAlertRepository } from "@/lib/alerting/repository/alert-repository-factory";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = getAuthenticatedUserEmail(req) ?? "anonymous";

  const url = new URL(req.url);
  const connectionId = url.searchParams.get("connection_id");
  if (!connectionId) {
    return NextResponse.json({ error: "connection_id is required" }, { status: 400 });
  }

  try {
    const rules = await getAlertRepository().getEnabledRulesDueForEvaluation(userId, connectionId);
    return NextResponse.json(rules);
  } catch (err) {
    console.error("[/api/alerts/rules/due] Failed to get due rules", err);
    return NextResponse.json({ error: "Failed to get due rules" }, { status: 500 });
  }
}
