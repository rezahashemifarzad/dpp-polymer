"use server";

/**
 * lib/actions/ask-assistant.ts
 * -----------------------------------------------------------------------
 * Server Actions backing the floating AI Assistant widget
 * (components/dashboard/ai-assistant-widget.tsx), mounted in two places:
 *
 *   - askAssistantAction — the original admin console entry point.
 *     Same dual-path reasoning as every other action in lib/actions/:
 *     this runs entirely server-side and needs no RBAC key, so it's what
 *     the admin console's chat drawer calls directly; POST
 *     /api/admin/assistant is the ADMIN-gated entry point for external
 *     callers — gated because a supplier-ranking question can surface
 *     SupplierTier data, which is ADMIN-gated everywhere else in this
 *     app (see app/api/admin/search/route.ts's identical reasoning).
 *
 *   - askPublicAssistantAction — the public-page entry point (mounted in
 *     components/PublicScanPage.tsx), added for the public rollout of
 *     this widget. Calls answerPublicAssistantQuestion(), a SEPARATE
 *     function in lib/services/ai-assistant.ts whose body never
 *     references the supplier-analytics or portfolio-expiry services —
 *     see that module's own file banner for why this is a structural
 *     guarantee rather than a checked permission. No REST counterpart:
 *     every question this can answer is already backed by data this app
 *     serves unauthenticated elsewhere (GET /api/passports and the GS1
 *     scan page itself), so there's nothing an external caller would
 *     gain from a dedicated route that the in-app Server Action doesn't
 *     already provide equally openly.
 */

import { answerAssistantQuestion, answerPublicAssistantQuestion, type AssistantAnswer } from "@/lib/services/ai-assistant";
import { requireAdminSession } from "@/lib/session-auth";

export interface AskAssistantActionResult {
  ok: boolean;
  data?: AssistantAnswer;
  error?: string;
}

export async function askAssistantAction(question: string): Promise<AskAssistantActionResult> {
  // Security fix (2026-09-29): this action was only "protected" by the
  // widget being mounted inside /admin (app/admin/layout.tsx). A Server
  // Action is a public POST endpoint in its own right — anyone who
  // extracted its action ID could call it without signing in and read
  // portfolio batch counts and supplier rankings (SupplierTier data is
  // ADMIN-gated everywhere else, see /api/admin/assistant). The action now
  // re-verifies a live, active ADMIN session itself, same check as the
  // /admin layout. Deliberately called OUTSIDE the try/catch below:
  // requireAdminSession() signals "not signed in" by throwing Next.js's
  // redirect (to /login), which must propagate, not be swallowed as an
  // ordinary error. askPublicAssistantAction is intentionally left open —
  // it can only reach answerPublicAssistantQuestion(), whose data is
  // already public (see this file's banner).
  await requireAdminSession();

  try {
    const data = await answerAssistantQuestion(question);
    return { ok: true, data };
  } catch (error) {
    console.error("askAssistantAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to answer the question" };
  }
}

export async function askPublicAssistantAction(question: string, contextBatchId?: string): Promise<AskAssistantActionResult> {
  try {
    const data = await answerPublicAssistantQuestion(question, contextBatchId);
    return { ok: true, data };
  } catch (error) {
    console.error("askPublicAssistantAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to answer the question" };
  }
}
