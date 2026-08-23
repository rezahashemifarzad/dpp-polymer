/**
 * app/api/passports/[batchId]/carbon-footprint/route.ts
 * -----------------------------------------------------------------------
 * POST /api/passports/{batchId}/carbon-footprint — compute and persist a
 * rough Scope 1/2/3 CO2e estimate for this batch (see
 * docs/CIRCULAR_ECONOMY_PLATFORM_UPGRADE_SPEC.md §2.2). External-caller
 * entry point, gated to MANUFACTURER or ADMIN via lib/rbac.ts. The in-app
 * admin UI uses lib/actions/calculate-carbon-footprint.ts (a Server
 * Action) instead — same pattern as passport creation and certifications.
 *
 * Params are awaited per Next.js 16 App Router conventions (dynamic
 * route params are async in this Next.js version — see AGENTS.md).
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { calculateAndPersistCarbonFootprint } from "@/lib/services/calculate-carbon-footprint";
import type { TransportMode } from "@/lib/utils/carbon-footprint-calculator";

const VALID_TRANSPORT_MODES: TransportMode[] = ["TRUCK", "RAIL", "SEA", "AIR"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;

  const role = authorize(req, ["MANUFACTURER", "ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  const input = body as { weightKg?: unknown; transportDistanceKm?: unknown; transportMode?: unknown };
  if (typeof input.weightKg !== "number") {
    return NextResponse.json({ success: false, error: "weightKg (number) is required" }, { status: 400 });
  }
  if (input.transportMode !== undefined && !VALID_TRANSPORT_MODES.includes(input.transportMode as TransportMode)) {
    return NextResponse.json(
      { success: false, error: `transportMode must be one of ${VALID_TRANSPORT_MODES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const result = await calculateAndPersistCarbonFootprint(
      batchId,
      {
        weightKg: input.weightKg,
        transportDistanceKm: typeof input.transportDistanceKm === "number" ? input.transportDistanceKm : undefined,
        transportMode: input.transportMode as TransportMode | undefined,
      },
      role
    );
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, ...("issues" in result ? { issues: result.issues } : {}) },
        { status: result.status }
      );
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error(`POST /api/passports/${batchId}/carbon-footprint failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to calculate carbon footprint" }, { status: 500 });
  }
}
