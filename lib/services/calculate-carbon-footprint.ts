/**
 * lib/services/calculate-carbon-footprint.ts
 * -----------------------------------------------------------------------
 * Computes and persists a rough Scope 1/2/3 CO2e estimate for a batch via
 * lib/utils/carbon-footprint-calculator.ts, storing it in the separate
 * CarbonFootprintCalculation table (see
 * docs/CIRCULAR_ECONOMY_PLATFORM_UPGRADE_SPEC.md §1.2). Upserts on
 * passportId — this is "latest calculation only" by design (see the
 * schema comment on CarbonFootprintCalculation).
 *
 * Deliberately does NOT touch PolymerPassport.carbonFootprintKgCO2ePerKg
 * — that field is the manufacturer's own, possibly third-party-verified
 * LCA figure, and this rough estimate must never silently overwrite it.
 */

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  calculateCarbonFootprint,
  type PolymerTypeForCarbon,
  type TransportMode,
} from "@/lib/utils/carbon-footprint-calculator";

type ZodFlatten = { formErrors: string[]; fieldErrors: Record<string, string[]> };

export interface CalculateCarbonFootprintInput {
  weightKg: number;
  transportDistanceKm?: number;
  transportMode?: TransportMode;
}

export type CalculateCarbonFootprintResult =
  | {
      ok: true;
      status: 200;
      data: {
        scope1KgCO2e: number;
        scope2KgCO2e: number;
        scope3KgCO2e: number;
        totalKgCO2e: number;
        emissionFactorVersion: string;
      };
    }
  | { ok: false; status: 400; error: string; issues?: ZodFlatten }
  | { ok: false; status: 404; error: string };

export async function calculateAndPersistCarbonFootprint(
  batchId: string,
  input: CalculateCarbonFootprintInput,
  actor: string
): Promise<CalculateCarbonFootprintResult> {
  const passport = await prisma.polymerPassport.findUnique({
    where: { batchId },
    select: { id: true, polymerType: true },
  });
  if (!passport) {
    return { ok: false, status: 404, error: `No passport found for batchId "${batchId}"` };
  }

  let breakdown;
  try {
    breakdown = calculateCarbonFootprint({
      polymerType: passport.polymerType as PolymerTypeForCarbon,
      weightKg: input.weightKg,
      transportDistanceKm: input.transportDistanceKm,
      transportMode: input.transportMode,
    });
  } catch (err) {
    return { ok: false, status: 400, error: (err as Error).message };
  }

  const saved = await prisma.$transaction(async (tx) => {
    const record = await tx.carbonFootprintCalculation.upsert({
      where: { passportId: passport.id },
      create: {
        passportId: passport.id,
        weightKg: input.weightKg,
        transportDistanceKm: input.transportDistanceKm ?? 0,
        transportMode: input.transportMode ?? "TRUCK",
        scope1KgCO2e: breakdown.scope1KgCO2e,
        scope2KgCO2e: breakdown.scope2KgCO2e,
        scope3KgCO2e: breakdown.scope3KgCO2e,
        totalKgCO2e: breakdown.totalKgCO2e,
        emissionFactorVersion: breakdown.emissionFactorVersion,
      },
      update: {
        weightKg: input.weightKg,
        transportDistanceKm: input.transportDistanceKm ?? 0,
        transportMode: input.transportMode ?? "TRUCK",
        scope1KgCO2e: breakdown.scope1KgCO2e,
        scope2KgCO2e: breakdown.scope2KgCO2e,
        scope3KgCO2e: breakdown.scope3KgCO2e,
        totalKgCO2e: breakdown.totalKgCO2e,
        emissionFactorVersion: breakdown.emissionFactorVersion,
        calculatedAt: new Date(),
      },
    });

    await writeAuditLog(tx, {
      passportId: passport.id,
      action: "CARBON_CALCULATED",
      actor,
      previousHash: null,
      newHash: null,
      metadata: { totalKgCO2e: breakdown.totalKgCO2e, emissionFactorVersion: breakdown.emissionFactorVersion },
    });

    return record;
  });

  return {
    ok: true,
    status: 200,
    data: {
      scope1KgCO2e: Number(saved.scope1KgCO2e),
      scope2KgCO2e: Number(saved.scope2KgCO2e),
      scope3KgCO2e: Number(saved.scope3KgCO2e),
      totalKgCO2e: Number(saved.totalKgCO2e),
      emissionFactorVersion: saved.emissionFactorVersion,
    },
  };
}
