/**
 * lib/utils/carbon-footprint-calculator.ts
 * -----------------------------------------------------------------------
 * Rough Scope 1/2/3 CO2e estimator for a polymer batch, driven by
 * polymer type, batch weight, and transport distance/mode. Pure and
 * dependency-free — runs identically client- and server-side, so the
 * exact same function can power a live admin-form preview and the
 * value actually persisted via the API.
 *
 * See docs/CIRCULAR_ECONOMY_PLATFORM_UPGRADE_SPEC.md §4.1.
 *
 * IMPORTANT — compliance caveat: the emission factors below are
 * illustrative placeholder defaults for a quick estimate, NOT a
 * licensed/certified emission-factor database (ecoinvent, DEFRA, etc.).
 * Per the same principle established for certifications in
 * docs/COMPLIANCE_CERTIFICATIONS_MODULE_SPEC.md — never present an
 * unverified figure to a consumer as if it were a confirmed fact — any
 * value this function produces must be labeled as an estimate wherever
 * it's shown, and must NEVER silently overwrite
 * PolymerPassport.carbonFootprintKgCO2ePerKg, which represents the
 * manufacturer's own (optionally third-party-verified) LCA figure.
 * Swap the factor tables below for a licensed source before relying on
 * this for anything beyond an internal rough estimate.
 */

export type PolymerTypeForCarbon =
  | "PET"
  | "HDPE"
  | "PVC"
  | "LDPE"
  | "PP"
  | "PS"
  | "PLA"
  | "PHA"
  | "PA"
  | "PC"
  | "ABS"
  | "OTHER";

export type TransportMode = "TRUCK" | "RAIL" | "SEA" | "AIR";

/**
 * Rough processing (Scope 1: on-site direct + Scope 2: purchased energy)
 * emission factors, kg CO2e per kg of material PROCESSED (compounding/
 * recycling only — NOT virgin-resin production). Illustrative mid-range
 * defaults; replace with a licensed factor database before relying on
 * these for anything beyond an internal estimate.
 */
const PROCESSING_EMISSION_FACTORS: Record<PolymerTypeForCarbon, { scope1: number; scope2: number }> = {
  PET: { scope1: 0.18, scope2: 0.22 },
  HDPE: { scope1: 0.15, scope2: 0.19 },
  PVC: { scope1: 0.2, scope2: 0.24 },
  LDPE: { scope1: 0.16, scope2: 0.2 },
  PP: { scope1: 0.15, scope2: 0.19 },
  PS: { scope1: 0.19, scope2: 0.23 },
  PLA: { scope1: 0.12, scope2: 0.16 },
  PHA: { scope1: 0.13, scope2: 0.17 },
  PA: { scope1: 0.24, scope2: 0.28 },
  PC: { scope1: 0.26, scope2: 0.3 },
  ABS: { scope1: 0.21, scope2: 0.25 },
  OTHER: { scope1: 0.18, scope2: 0.22 },
};

/** Rough freight emission factors, kg CO2e per tonne-km. Illustrative. */
const TRANSPORT_EMISSION_FACTORS: Record<TransportMode, number> = {
  TRUCK: 0.1,
  RAIL: 0.03,
  SEA: 0.015,
  AIR: 0.6,
};

export const EMISSION_FACTOR_VERSION = "illustrative-v1-2026";

export interface CarbonFootprintInput {
  polymerType: PolymerTypeForCarbon;
  weightKg: number;
  transportDistanceKm?: number;
  transportMode?: TransportMode;
}

export interface CarbonFootprintBreakdown {
  scope1KgCO2e: number;
  scope2KgCO2e: number;
  scope3KgCO2e: number;
  totalKgCO2e: number;
  perKgCO2e: number;
  emissionFactorVersion: string;
}

export function calculateCarbonFootprint(input: CarbonFootprintInput): CarbonFootprintBreakdown {
  const { polymerType, weightKg, transportDistanceKm = 0, transportMode = "TRUCK" } = input;

  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error("weightKg must be a positive number");
  }
  if (!Number.isFinite(transportDistanceKm) || transportDistanceKm < 0) {
    throw new Error("transportDistanceKm must be zero or a positive number");
  }

  const factors = PROCESSING_EMISSION_FACTORS[polymerType] ?? PROCESSING_EMISSION_FACTORS.OTHER;
  const transportFactor = TRANSPORT_EMISSION_FACTORS[transportMode];

  const scope1KgCO2e = round3(factors.scope1 * weightKg);
  const scope2KgCO2e = round3(factors.scope2 * weightKg);
  // tonne-km = (weightKg / 1000) * distanceKm
  const scope3KgCO2e = round3(transportFactor * (weightKg / 1000) * transportDistanceKm);
  const totalKgCO2e = round3(scope1KgCO2e + scope2KgCO2e + scope3KgCO2e);

  return {
    scope1KgCO2e,
    scope2KgCO2e,
    scope3KgCO2e,
    totalKgCO2e,
    perKgCO2e: round3(totalKgCO2e / weightKg),
    emissionFactorVersion: EMISSION_FACTOR_VERSION,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
