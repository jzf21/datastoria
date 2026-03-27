import { getAuthenticatedUserEmail } from "@/auth";
import type { CreateAlertRuleInput } from "@/lib/alerting/alert-types";
import { DEFAULT_ALERT_RULES } from "@/lib/alerting/engine/builtin-rules";
import { getAlertRepository } from "@/lib/alerting/repository/alert-repository-factory";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = getAuthenticatedUserEmail(req) ?? "anonymous";

  try {
    const repository = getAlertRepository();
    let rules = await repository.listRules(userId);

    // Auto-seed default rules on first access
    if (rules.length === 0) {
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
      }
      rules = await repository.listRules(userId);
    }

    return NextResponse.json(rules);
  } catch (err) {
    console.error("[/api/alerts/rules] Failed to list rules", err);
    return NextResponse.json({ error: "Failed to list rules" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = getAuthenticatedUserEmail(req) ?? "anonymous";

  let payload: Partial<CreateAlertRuleInput> | null = null;
  try {
    payload = (await req.json()) as Partial<CreateAlertRuleInput>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload?.name || !payload.category || !payload.condition) {
    return NextResponse.json({ error: "Missing required fields: name, category, condition" }, { status: 400 });
  }

  try {
    const rule = await getAlertRepository().createRule({
      id: payload.id ?? crypto.randomUUID(),
      user_id: userId,
      connection_id: payload.connection_id ?? null,
      name: payload.name,
      description: payload.description ?? null,
      rule_type: payload.rule_type ?? "custom",
      category: payload.category,
      severity: payload.severity ?? "WARNING",
      enabled: payload.enabled ?? true,
      condition: payload.condition,
      evaluation_interval_seconds: payload.evaluation_interval_seconds ?? 300,
      cooldown_seconds: payload.cooldown_seconds ?? 900,
      channels: payload.channels,
    });
    return NextResponse.json(rule, { status: 201 });
  } catch (err) {
    console.error("[/api/alerts/rules] Failed to create rule", err);
    return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
  }
}
