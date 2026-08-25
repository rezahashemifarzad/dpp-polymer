/**
 * app/api/form-suggestions/route.ts
 * -----------------------------------------------------------------------
 * GET /api/form-suggestions — autocomplete data for form fields (Grade,
 * Manufacturer, Chain-of-Custody Participant Name). See
 * lib/services/form-suggestions.ts for why this is deliberately public:
 * every value returned is already part of the unauthenticated public
 * QR-scan view for at least one issued passport, same reasoning as GET
 * /api/certifications/expiry-alerts.
 */

import { NextResponse } from "next/server";
import { getFormSuggestions } from "@/lib/services/form-suggestions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getFormSuggestions();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/form-suggestions failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load form suggestions" }, { status: 500 });
  }
}
