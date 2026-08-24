"use client";

/**
 * lib/hooks/use-passport-trend.ts
 * -----------------------------------------------------------------------
 * Client-side data layer over GET /api/passports/analytics — the home
 * dashboard's live monthly PCR/Compliance trend (see
 * lib/services/passport-monthly-trend.ts). Mirrors lib/hooks/use-passports.ts's
 * shape (loading/error state, refetch) but kept as its own small hook
 * rather than folded into usePassports(), since it's a different endpoint
 * with a different response shape and (today) a single consumer.
 */

import { useCallback, useEffect, useState } from "react";

export interface PassportTrendPoint {
  month: string;
  avgPcr: number;
  compliance: number;
  batchCount: number;
}

interface TrendResponse {
  success: boolean;
  data: PassportTrendPoint[];
  error?: string;
}

export function usePassportTrend(months = 12) {
  const [data, setData] = useState<PassportTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/passports/analytics?months=${months}`, { cache: "no-store" });
      const json: TrendResponse = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Request failed with status ${res.status}`);
      }
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trend data");
    } finally {
      setLoading(false);
    }
  }, [months]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
