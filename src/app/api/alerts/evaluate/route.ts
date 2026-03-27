import { getAuthenticatedUserEmail } from "@/auth";
import type { EvaluationResult } from "@/lib/alerting/engine/alert-evaluator";
import { processEvaluationResultForUser } from "@/lib/alerting/engine/alert-evaluator";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = getAuthenticatedUserEmail(req) ?? "anonymous";

  let results: EvaluationResult[] | null = null;
  try {
    results = (await req.json()) as EvaluationResult[];
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(results) || results.length === 0) {
    return NextResponse.json({ error: "Expected non-empty array of evaluation results" }, { status: 400 });
  }

  try {
    for (const result of results) {
      await processEvaluationResultForUser(userId, result);
    }
    return NextResponse.json({ ok: true, processed: results.length });
  } catch (err) {
    console.error("[/api/alerts/evaluate] Failed to process evaluation results", err);
    return NextResponse.json({ error: "Failed to process evaluation results" }, { status: 500 });
  }
}
