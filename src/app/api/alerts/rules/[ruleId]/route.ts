import { getAuthenticatedUserEmail } from "@/auth";
import type { UpdateAlertRuleInput } from "@/lib/alerting/alert-types";
import { getAlertRepository } from "@/lib/alerting/repository/alert-repository-factory";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ ruleId: string }> };

export async function GET(req: Request, context: RouteContext) {
  const userId = getAuthenticatedUserEmail(req) ?? "anonymous";

  const { ruleId } = await context.params;
  try {
    const rule = await getAlertRepository().getRule(userId, ruleId);
    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    return NextResponse.json(rule);
  } catch (err) {
    console.error("[/api/alerts/rules/[ruleId]] Failed to get rule", err);
    return NextResponse.json({ error: "Failed to get rule" }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const userId = getAuthenticatedUserEmail(req) ?? "anonymous";

  const { ruleId } = await context.params;
  let payload: Partial<UpdateAlertRuleInput> | null = null;
  try {
    payload = (await req.json()) as Partial<UpdateAlertRuleInput>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const updated = await getAlertRepository().updateRule({
      id: ruleId,
      user_id: userId,
      ...payload,
    });
    if (!updated) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[/api/alerts/rules/[ruleId]] Failed to update rule", err);
    return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const userId = getAuthenticatedUserEmail(req) ?? "anonymous";

  const { ruleId } = await context.params;
  try {
    await getAlertRepository().deleteRule(userId, ruleId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/alerts/rules/[ruleId]] Failed to delete rule", err);
    return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
  }
}
