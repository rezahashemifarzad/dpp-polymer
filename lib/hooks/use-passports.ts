"use client";

/**
 * lib/hooks/use-passports.ts
 * -----------------------------------------------------------------------
 * Client-side data layer over /api/passports. Owns loading/error state so
 * page components can render skeletons and fallback UI instead of
 * reaching for the array directly.
 *
 * Decimal fields (meltFlowIndex, density, recycledContentPercent,
 * totalRecycledPercent, bioBasedPercent, carbonFootprintKgCO2ePerKg)
 * arrive as strings — Prisma.Decimal serializes to its exact decimal
 * string via toJSON(), never a lossy JS float. Components should keep
 * them as strings for display and only `Number(...)` them at the point of
 * a calculation, never round-trip them back into an API call as a float.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPassportAction } from "@/lib/actions/create-passport";
import { linkBatchGenealogyAction } from "@/lib/actions/link-batch-genealogy";
import { calculateCarbonFootprintAction } from "@/lib/actions/calculate-carbon-footprint";
import { addChainOfCustodyRecordAction } from "@/lib/actions/add-chain-of-custody-record";
import { declareSvhcStatusAction } from "@/lib/actions/declare-svhc-status";
import { declarePpwrComplianceAction } from "@/lib/actions/declare-ppwr-compliance";

export interface ApiCertification {
  id: string;
  scheme: string;
  certificateId: string;
  issuingBody: string;
  validFrom: string;
  validUntil: string;
  documentUrl?: string | null;
}

export interface ApiManufacturer {
  id: string;
  legalName: string;
  country: string;
}

export type DppStatusValue = "DRAFT" | "PENDING_VERIFICATION" | "ISSUED" | "REVOKED" | "SUPERSEDED";

// Compliance Expiry Alerts (docs/CIRCULAR_ECONOMY_PLATFORM_UPGRADE_SPEC.md
// §2.4) — computed server-side in GET /api/passports from
// Certification.validUntil, not a stored column. See
// lib/utils/certification-status.ts for how it's derived.
export interface ApiCertificationAlert {
  level: "EXPIRED" | "EXPIRING_SOON" | null;
  expiredCount: number;
  expiringSoonCount: number;
}

// Circular Economy Platform Upgrade (Step 3) — genealogy + carbon footprint.
// Both arrive nested off GET /api/passports / GET /api/passports/[batchId]
// (see the `include` blocks added to those routes). Decimal fields are
// strings for the same reason as the rest of this file — see the file
// banner comment.
export interface ApiGenealogyParentSummary {
  id: string;
  batchId: string;
  gtin: string;
  polymerType: string;
  grade: string;
  recycledContentPercent: string;
  qrCodePayloadUrl: string | null;
}

export interface ApiGenealogyLink {
  id: string;
  quantityUsedKg: string | null;
  notes: string | null;
  parentPassport: ApiGenealogyParentSummary;
}

export interface ApiCarbonFootprintCalculation {
  id: string;
  weightKg: string;
  transportDistanceKm: string;
  transportMode: "TRUCK" | "RAIL" | "SEA" | "AIR";
  scope1KgCO2e: string;
  scope2KgCO2e: string;
  scope3KgCO2e: string;
  totalKgCO2e: string;
  emissionFactorVersion: string;
  calculatedAt: string;
}

// Multi-tier Supply Chain Verification & Auditor Portal Expansion — see
// prisma/schema.prisma's ChainOfCustodyRecord model. Decimal field
// (massBalanceAllocationPercent) is a string for the same reason as the
// rest of this file. `status`/`reviewedBy`/`reviewedAt`/`reviewNotes` are
// included here unfiltered (this is the admin-facing shape) — the public
// scan page filters to VERIFIED-only itself, same convention as
// certifications.
export type ChainOfCustodyTierValue =
  | "RAW_MATERIAL_SUPPLIER"
  | "RECYCLER"
  | "COMPOUNDER"
  | "PROCESSOR"
  | "DISTRIBUTOR"
  | "OTHER";

export type ChainOfCustodyStatusValue = "PENDING_REVIEW" | "VERIFIED" | "FLAGGED" | "REJECTED";

export interface ApiChainOfCustodyRecord {
  id: string;
  sequence: number;
  tier: ChainOfCustodyTierValue;
  participantName: string;
  participantCountry: string | null;
  externalBatchId: string;
  certificationScheme: string | null;
  certificateId: string | null;
  certificateDocumentUrl: string | null;
  massBalanceAllocationPercent: string | null;
  notes: string | null;
  status: ChainOfCustodyStatusValue;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  recordHash: string | null;
  createdAt: string;
}

// REACH SVHC & PPWR Compliance — see prisma/schema.prisma's SvhcStatus /
// SubstanceDeclaration / PolymerPassport.ppwr* fields. concentrationPercent
// is a string for the same Decimal-precision reason as every other numeric
// field in this file.
export type SvhcStatusValue = "NOT_ASSESSED" | "NONE_DECLARED" | "SVHC_PRESENT";

export interface ApiSubstanceDeclaration {
  id: string;
  casNumber: string;
  substanceName: string;
  concentrationPercent: string;
  candidateListDate: string;
  safeUseInstructions: string | null;
  declaredAt: string;
  declaredBy: string;
}

export interface ApiPassport {
  id: string;
  polymerType: string;
  grade: string;
  meltFlowIndex: string;
  density: string;
  gtin: string;
  recycledContentSource: string | null;
  recycledContentPercent: string;
  totalRecycledPercent: string;
  bioBasedPercent: string;
  carbonFootprintKgCO2ePerKg: string;
  lcaThirdPartyVerified: boolean;
  batchId: string;
  manufacturerId: string | null;
  manufacturer: ApiManufacturer | null;
  recordHash: string | null;
  qrCodePayloadUrl: string | null;
  status: DppStatusValue;
  certifications: ApiCertification[];
  certificationAlert: ApiCertificationAlert;
  parentLinks: ApiGenealogyLink[];
  carbonFootprintCalculation: ApiCarbonFootprintCalculation | null;
  chainOfCustodyRecords: ApiChainOfCustodyRecord[];
  svhcStatus: SvhcStatusValue;
  svhcStatusDeclaredAt: string | null;
  substanceDeclarations: ApiSubstanceDeclaration[];
  ppwrRecyclabilityGrade: string | null;
  ppwrPfasCompliant: boolean | null;
  ppwrPfasConcentrationPpb: string | null;
  ppwrAssessedAt: string | null;
  createdAt: string;
}

interface PassportsListResponse {
  success: boolean;
  data: ApiPassport[];
  error?: string;
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface CreatePassportInput {
  polymerType: string;
  grade: string;
  meltFlowIndex: number;
  density: number;
  gtin: string;
  recycledContentSource?: string;
  recycledContentPercent?: number;
  recycledContentCertScheme?: string;
  bioBasedPercent?: number;
  carbonFootprintKgCO2ePerKg?: number;
  batchId: string;
  manufacturerId: string;
  certifications: Array<{
    scheme: string;
    certificateId: string;
    issuingBody: string;
    validFrom: string;
    validUntil: string;
  }>;
}

export class PassportValidationError extends Error {
  fieldErrors: Record<string, string[]>;
  constructor(message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = "PassportValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export function usePassports() {
  const [data, setData] = useState<ApiPassport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/passports", { cache: "no-store" });
      const json: PassportsListResponse = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Request failed with status ${res.status}`);
      }
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load passports");
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const createPassport = useCallback(
    async (input: CreatePassportInput): Promise<ApiPassport> => {
      // Calls the createPassportAction Server Action directly — Next.js
      // handles this as an RPC to server-only code, not a client-side
      // fetch() to the public /api/passports route, so this in-app flow
      // keeps working without ever needing the POST route's
      // API_SECRET_KEY (which must never be exposed to browser code).
      const result = await createPassportAction(input);
      if (!result.ok) {
        if (result.issues?.fieldErrors) {
          throw new PassportValidationError(result.error || "Validation failed", result.issues.fieldErrors);
        }
        throw new Error(result.error || "Failed to create passport");
      }
      await refetch();
      return result.data as ApiPassport;
    },
    [refetch]
  );

  const linkParentBatch = useCallback(
    async (childBatchId: string, input: { parentBatchId: string; quantityUsedKg?: number; notes?: string }) => {
      // Same Server Action pattern as createPassport above — runs
      // server-side only, never needs the RBAC key that POST
      // /api/passports/[batchId]/parents requires for external callers.
      const result = await linkBatchGenealogyAction(childBatchId, input);
      if (!result.ok) {
        throw new Error(result.error || "Failed to link parent batch");
      }
      await refetch();
      return result.data;
    },
    [refetch]
  );

  const calculateCarbonFootprint = useCallback(
    async (
      batchId: string,
      input: { weightKg: number; transportDistanceKm?: number; transportMode?: "TRUCK" | "RAIL" | "SEA" | "AIR" }
    ) => {
      const result = await calculateCarbonFootprintAction(batchId, input);
      if (!result.ok) {
        throw new Error(result.error || "Failed to calculate carbon footprint");
      }
      await refetch();
      return result.data;
    },
    [refetch]
  );

  const addChainOfCustodyRecord = useCallback(
    async (
      batchId: string,
      input: {
        tier: ChainOfCustodyTierValue;
        participantName: string;
        participantCountry?: string;
        externalBatchId: string;
        certificationScheme?: string;
        certificateId?: string;
        certificateDocumentUrl?: string;
        certificateDocumentHash?: string;
        massBalanceAllocationPercent?: number;
        notes?: string;
      }
    ) => {
      // Same Server Action pattern as linkParentBatch/calculateCarbonFootprint
      // above — runs server-side only, never needs the RBAC key that POST
      // /api/passports/[batchId]/chain-of-custody requires for external
      // callers.
      const result = await addChainOfCustodyRecordAction(batchId, input);
      if (!result.ok) {
        if (result.issues?.fieldErrors) {
          throw new PassportValidationError(result.error || "Validation failed", result.issues.fieldErrors);
        }
        throw new Error(result.error || "Failed to add chain-of-custody record");
      }
      await refetch();
      return result.data;
    },
    [refetch]
  );

  const declareSvhcStatus = useCallback(
    async (
      batchId: string,
      input: {
        status: SvhcStatusValue;
        substances?: Array<{
          casNumber: string;
          substanceName: string;
          concentrationPercent: number;
          candidateListDate: string;
          safeUseInstructions?: string;
        }>;
      }
    ) => {
      // Same Server Action pattern as addChainOfCustodyRecord above — runs
      // server-side only, never needs the RBAC key that PATCH
      // /api/passports/[batchId]/svhc requires for external callers.
      const result = await declareSvhcStatusAction(batchId, input);
      if (!result.ok) {
        if (result.issues?.fieldErrors) {
          throw new PassportValidationError(result.error || "Validation failed", result.issues.fieldErrors);
        }
        throw new Error(result.error || "Failed to declare SVHC status");
      }
      await refetch();
      return result.data;
    },
    [refetch]
  );

  const declarePpwrCompliance = useCallback(
    async (
      batchId: string,
      input: { recyclabilityGrade?: string; pfasCompliant?: boolean; pfasConcentrationPpb?: number }
    ) => {
      const result = await declarePpwrComplianceAction(batchId, input);
      if (!result.ok) {
        if (result.issues?.fieldErrors) {
          throw new PassportValidationError(result.error || "Validation failed", result.issues.fieldErrors);
        }
        throw new Error(result.error || "Failed to declare PPWR compliance");
      }
      await refetch();
      return result.data;
    },
    [refetch]
  );

  return {
    data,
    loading,
    error,
    hasLoadedOnce: hasLoadedOnce.current,
    refetch,
    createPassport,
    linkParentBatch,
    calculateCarbonFootprint,
    addChainOfCustodyRecord,
    declareSvhcStatus,
    declarePpwrCompliance,
  };
}
