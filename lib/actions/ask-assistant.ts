"use server";

/**
 * lib/actions/ask-assistant.ts
 * -----------------------------------------------------------------------
 * Server Action backing the floating AI Assistant widget
 * (components/dashboard/ai-assistant-widget.tsx). Same dual-path
 * reasoning as every other action in lib/actions/: this runs entirely
 * server-side and needs no RBAC key, so it's what the in-app chat drawer
 * calls directly; POST /api/admin/assistant is the ADMIN-gated entry
 * point for external callers — gated because a supplier-ranking question
 * can surface SupplierTier data, which is ADMIN-gated everywhere else in
 * this app (see app/api/admin/search/route.ts's identical reasoning).
 */

import { answerAssistantQuestion, type AssistantAnswer } from "@/lib/services/ai-assistant";

export interface AskAssistantActionResult {
  ok: boolean;
  data?: AssistantAnswer;
  error?: string;
}

export async function askAssistantAction(question: string): Promise<AskAssistantActionResult> {
  try {
    const data = await answerAssistantQuestion(question);
    return { ok: true, data };
  } catch (error) {
    console.error("askAssistantAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to answer the question" };
  }
}
