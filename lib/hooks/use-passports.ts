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

  return {
    data,
    loading,
    error,
    hasLoadedOnce: hasLoadedOnce.current,
    refetch,
    createPassport,
  };
}
