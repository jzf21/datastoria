import { getAuthenticatedUserEmail } from "@/auth";
import { DEFAULT_ALERT_RULES } from "@/lib/alerting/engine/builtin-rules";
import { getAlertRepository } from "@/lib/alerting/repository/alert-repository-factory";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = getAuthenticatedUserEmail(req) ?? "anonymous";

  try {
    const repository = getAlertRepository();
    const existingRules = await repository.listRules(userId);

    // Only seed if user has zero rules (first-time setup)
    if (existingRules.length > 0) {
      return NextResponse.json({ ok: true, seeded: 0 });
    }

    let seeded = 0;
    for (const template of DEFAULT_ALERT_RULES) {
      await repository.createRule({
        id: crypto.randomUUID(),
        user_id: userId,
        name: template.name,
        description: template.description,
        rule_type: "custom",
        category: template.category,
        severity: template.severity,
        condition: template.condition,
        evaluation_interval_seconds: template.evaluation_interval_seconds,
        cooldown_seconds: template.cooldown_seconds,
      });
      seeded++;
    }

    return NextResponse.json({ ok: true, seeded });
  } catch (err) {
    console.error("[/api/alerts/rules/seed] Failed to seed default rules", err);
    return NextResponse.json({ error: "Failed to seed default rules" }, { status: 500 });
  }
}
