/**
 * app/api/admin/assistant/route.ts
 * -----------------------------------------------------------------------
 * POST /api/admin/assistant — external-caller entry point for the AI
 * Assistant widget's answer engine (lib/services/ai-assistant.ts).
 * ADMIN-gated via lib/rbac.ts: a supplier-ranking question can surface
 * SupplierTier data, which is ADMIN-gated everywhere else this app
 * exposes it (app/api/admin/supplier-analytics/route.ts,
 * app/api/admin/search/route.ts) — same "a route is only as protected as
 * its most sensitive included field" reasoning as that search route's
 * own banner. The in-app widget instead calls
 * lib/actions/ask-assistant.ts's Server Action directly, same dual-path
 * pattern used everywhere else in this app.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { answerAssistantQuestion } from "@/lib/services/ai-assistant";

const AskSchema = z.object({
  question: z.string().min(1).max(500),
});

export async function POST(req: NextRequest) {
  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  try {
    const body = await req.json();
    const parsed = AskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "A non-empty `question` string (max 500 chars) is required." },
        { status: 400 }
      );
    }

    const data = await answerAssistantQuestion(parsed.data.question);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("POST /api/admin/assistant failed:", error);
    return NextResponse.json({ success: false, error: "Failed to answer the question" }, { status: 500 });
  }
}
