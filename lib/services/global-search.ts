/**
 * lib/services/global-search.ts
 * -----------------------------------------------------------------------
 * Phase 7 - Step 3: Advanced Global Search & Multi-Layer Filtering Suite.
 *
 * A single read-only entry point — searchGlobal() — that queries four
 * entity types simultaneously: batches (PolymerPassport), certificates
 * (Certification), suppliers (Manufacturer), and audit log entries
 * (AuditLog). "Compute, don't store" — same principle as every other
 * analytics/report file in this app (esg-analytics.ts, supplier-analytics.ts,
 * lib/utils/certification-status.ts): nothing here is a stored index or
 * cached search result, every query runs fresh against the live ledger.
 *
 * SCOPE NOTE — manufacturer tiers. "Manufacturer tier" is a COMPUTED
 * ranking (lib/services/supplier-analytics.ts's SupplierTier), not a
 * stored column anywhere. Filtering or badging by tier therefore requires
 * resolving the full supplier ranking once per search call and building a
 * manufacturerId -> tier lookup from it — the same "compute fresh, no
 * cached rank" contract supplier-analytics.ts itself documents. This is
 * only computed when a caller actually needs it (a SUPPLIER-type search,
 * an explicit tier filter, or a BATCH/CERTIFICATE search that wants tier
 * badges on its results) so a plain free-text batch search doesn't pay for
 * a full portfolio ranking it never uses.
 *
 * SCOPE NOTE — free-text matching. Every entity's OR-matched fields mirror
 * an already-established search/filter convention elsewhere in this app
 * rather than inventing a new one: batches reuse GET /api/passports's own
 * `search` field set (batchId/grade/gtin/manufacturer name), audit logs
 * reuse lib/services/audit-log-service.ts's buildAuditLogWhere exactly
 * (actor + passport.batchId substring match — that file's own comment
 * explains why AuditAction itself isn't free-text matched), certificates
 * and suppliers extend the same `contains`, `mode: "insensitive"` pattern
 * to their own natural identifying fields.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { PolymerType, DppStatus, CertificationVerificationStatus, AuditAction } from "@prisma/client";
import { getSupplierAnalytics, type SupplierTier } from "@/lib/services/supplier-analytics";
import { getAuditLogFilterOptions } from "@/lib/services/audit-log-service";
import { getExpiryAlertTier } from "@/lib/utils/certification-status";

export const ALL_SEARCH_ENTITY_TYPES = ["BATCH", "CERTIFICATE", "SUPPLIER", "AUDIT_LOG"] as const;
export type SearchEntityType = (typeof ALL_SEARCH_ENTITY_TYPES)[number];

export type SearchResultTone = "success" | "warning" | "danger" | "neutral" | "info";

export interface SearchResultBadge {
  label: string;
  tone: SearchResultTone;
}

export interface SearchResultItem {
  id: string;
  entityType: SearchEntityType;
  title: string;
  subtitle: string;
  badges: SearchResultBadge[];
  href: string;
  timestamp: string | null; // ISO — the entity's own natural date, for sort/display only
}

export interface GlobalSearchFilters {
  query?: string;
  entityTypes?: SearchEntityType[]; // empty/undefined = search all four
  polymerTypes?: string[];
  dppStatuses?: string[];
  certVerificationStatuses?: string[];
  supplierTiers?: string[]; // SupplierTier[] as strings — validated against SUPPLIER_TIER_OPTIONS below
  auditActions?: string[];
  dateFrom?: string; // ISO date string — applies to each entity's own natural date field
  dateTo?: string;
  limitPerType?: number;
}

export interface GlobalSearchFilterOptions {
  polymerTypes: string[];
  dppStatuses: string[];
  certVerificationStatuses: string[];
  supplierTiers: SupplierTier[];
  auditActions: string[];
}

export interface GlobalSearchResult {
  query: string;
  countsByType: Record<SearchEntityType, number>; // TOTAL matches per type, not capped by limitPerType
  totalCount: number;
  results: SearchResultItem[]; // merged across types, capped per type, sorted by timestamp desc (nulls last)
  filterOptions: GlobalSearchFilterOptions;
}

const DEFAULT_LIMIT_PER_TYPE = 8;
const MAX_LIMIT_PER_TYPE = 50;

const SUPPLIER_TIER_OPTIONS: SupplierTier[] = ["Preferred", "Approved", "Watch", "At Risk"];

function statusTone(status: string): SearchResultTone {
  if (status === "ISSUED") return "success";
  if (status === "PENDING_VERIFICATION" || status === "DRAFT") return "warning";
  if (status === "REVOKED") return "danger";
  return "neutral";
}

function verificationTone(status: string): SearchResultTone {
  if (status === "VERIFIED") return "success";
  if (status === "PENDING_REVIEW") return "warning";
  if (status === "REJECTED") return "danger";
  return "neutral";
}

function expiryTone(tier: string | null): SearchResultTone | null {
  if (tier === "EXPIRED") return "danger";
  if (tier === "EXPIRING_URGENT") return "warning";
  if (tier === "EXPIRING_SOON") return "info";
  return null;
}

function tierTone(tier: SupplierTier | "Insufficient Data"): SearchResultTone {
  if (tier === "Preferred") return "success";
  if (tier === "Approved") return "info";
  if (tier === "Watch") return "warning";
  if (tier === "At Risk") return "danger";
  return "neutral";
}

function actionTone(action: string): SearchResultTone {
  if (/REJECT|REVOK|FLAG/.test(action)) return "danger";
  if (/ALERT|PENDING/.test(action)) return "warning";
  if (/VERIF|APPROVED|SENT/.test(action)) return "success";
  return "neutral";
}

export async function searchGlobal(filters: GlobalSearchFilters): Promise<GlobalSearchResult> {
  const query = (filters.query ?? "").trim();
  const types: SearchEntityType[] =
    filters.entityTypes && filters.entityTypes.length > 0 ? filters.entityTypes : [...ALL_SEARCH_ENTITY_TYPES];
  const limit = Math.min(Math.max(Math.floor(filters.limitPerType ?? DEFAULT_LIMIT_PER_TYPE), 1), MAX_LIMIT_PER_TYPE);

  const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
  const dateTo = filters.dateTo ? new Date(filters.dateTo) : undefined;
  const validDateFrom = dateFrom && !Number.isNaN(dateFrom.getTime()) ? dateFrom : undefined;
  const validDateTo = dateTo && !Number.isNaN(dateTo.getTime()) ? dateTo : undefined;

  const tierFilterActive = !!(filters.supplierTiers && filters.supplierTiers.length > 0);

  // Tier is computed, not stored (see file banner) — only pay for a full
  // supplier ranking pass when a result set actually needs it: a SUPPLIER
  // search (for its own tier badge), a BATCH/CERTIFICATE search (nice tier
  // badge + the ability to filter by it), or any search with an explicit
  // tier filter set.
  const needsTierMap = tierFilterActive || types.includes("SUPPLIER") || types.includes("BATCH") || types.includes("CERTIFICATE");
  const tierByManufacturerId = new Map<string, SupplierTier | "Insufficient Data">();
  if (needsTierMap) {
    const analytics = await getSupplierAnalytics();
    for (const s of analytics.suppliers) tierByManufacturerId.set(s.manufacturerId, s.tier);
  }
  const manufacturerIdsInTiers: Set<string> | null = tierFilterActive
    ? new Set(
        Array.from(tierByManufacturerId.entries())
          .filter(([, tier]) => filters.supplierTiers!.includes(tier))
          .map(([id]) => id)
      )
    : null;
  // An active tier filter that matches zero manufacturers should return
  // zero rows for every tier-filterable entity type, not "no filter" —
  // mirrors audit-log-service.ts's own `in: []` -> zero-rows convention
  // for an unrecognized actorRole.
  const tierFilterManufacturerIds = manufacturerIdsInTiers ? Array.from(manufacturerIdsInTiers) : undefined;

  const [batch, certificate, supplier, auditLog] = await Promise.all([
    types.includes("BATCH")
      ? searchBatches(query, filters, validDateFrom, validDateTo, tierFilterManufacturerIds, tierByManufacturerId, limit)
      : Promise.resolve({ items: [] as SearchResultItem[], count: 0 }),
    types.includes("CERTIFICATE")
      ? searchCertificates(query, filters, validDateFrom, validDateTo, tierFilterManufacturerIds, tierByManufacturerId, limit)
      : Promise.resolve({ items: [] as SearchResultItem[], count: 0 }),
    types.includes("SUPPLIER")
      ? searchSuppliers(query, filters, tierFilterManufacturerIds, tierByManufacturerId, limit)
      : Promise.resolve({ items: [] as SearchResultItem[], count: 0 }),
    types.includes("AUDIT_LOG")
      ? searchAuditLogs(query, filters, validDateFrom, validDateTo, tierFilterManufacturerIds, limit)
      : Promise.resolve({ items: [] as SearchResultItem[], count: 0 }),
  ]);

  const results = [...batch.items, ...certificate.items, ...supplier.items, ...auditLog.items].sort((a, b) => {
    if (a.timestamp === null && b.timestamp === null) return 0;
    if (a.timestamp === null) return 1;
    if (b.timestamp === null) return -1;
    return b.timestamp.localeCompare(a.timestamp);
  });

  const countsByType: Record<SearchEntityType, number> = {
    BATCH: batch.count,
    CERTIFICATE: certificate.count,
    SUPPLIER: supplier.count,
    AUDIT_LOG: auditLog.count,
  };

  const auditFilterOptions = await getAuditLogFilterOptions();

  return {
    query,
    countsByType,
    totalCount: batch.count + certificate.count + supplier.count + auditLog.count,
    results,
    filterOptions: {
      polymerTypes: Object.values(PolymerType),
      dppStatuses: Object.values(DppStatus),
      certVerificationStatuses: Object.values(CertificationVerificationStatus),
      supplierTiers: SUPPLIER_TIER_OPTIONS,
      auditActions: auditFilterOptions.actions,
    },
  };
}

async function searchBatches(
  query: string,
  filters: GlobalSearchFilters,
  dateFrom: Date | undefined,
  dateTo: Date | undefined,
  tierManufacturerIds: string[] | undefined,
  tierByManufacturerId: Map<string, SupplierTier | "Insufficient Data">,
  limit: number
): Promise<{ items: SearchResultItem[]; count: number }> {
  const where: Prisma.PolymerPassportWhereInput = {};

  if (query) {
    where.OR = [
      { batchId: { contains: query, mode: "insensitive" } },
      { grade: { contains: query, mode: "insensitive" } },
      { gtin: { contains: query, mode: "insensitive" } },
      { manufacturer: { legalName: { contains: query, mode: "insensitive" } } },
    ];
  }
  if (filters.polymerTypes && filters.polymerTypes.length > 0) {
    where.polymerType = { in: filters.polymerTypes as PolymerType[] };
  }
  if (filters.dppStatuses && filters.dppStatuses.length > 0) {
    where.status = { in: filters.dppStatuses as DppStatus[] };
  }
  if (dateFrom || dateTo) {
    where.productionDate = { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) };
  }
  if (tierManufacturerIds) {
    where.manufacturerId = { in: tierManufacturerIds };
  }

  const [count, rows] = await Promise.all([
    prisma.polymerPassport.count({ where }),
    prisma.polymerPassport.findMany({
      where,
      orderBy: { productionDate: "desc" },
      take: limit,
      select: {
        id: true,
        batchId: true,
        grade: true,
        polymerType: true,
        status: true,
        productionDate: true,
        totalRecycledPercent: true,
        manufacturerId: true,
        manufacturer: { select: { legalName: true } },
      },
    }),
  ]);

  const items: SearchResultItem[] = rows.map((p) => {
    const badges: SearchResultBadge[] = [{ label: p.status, tone: statusTone(p.status) }];
    if (p.manufacturerId) {
      const tier = tierByManufacturerId.get(p.manufacturerId);
      if (tier) badges.push({ label: tier, tone: tierTone(tier) });
    }
    return {
      id: p.id,
      entityType: "BATCH",
      title: p.batchId,
      subtitle: `${p.grade} · ${p.polymerType} · ${Number(p.totalRecycledPercent)}% PCR${p.manufacturer ? ` · ${p.manufacturer.legalName}` : ""}`,
      badges,
      href: `/admin#batch-row-${encodeURIComponent(p.batchId)}`,
      timestamp: p.productionDate.toISOString(),
    };
  });

  return { items, count };
}

async function searchCertificates(
  query: string,
  filters: GlobalSearchFilters,
  dateFrom: Date | undefined,
  dateTo: Date | undefined,
  tierManufacturerIds: string[] | undefined,
  tierByManufacturerId: Map<string, SupplierTier | "Insufficient Data">,
  limit: number
): Promise<{ items: SearchResultItem[]; count: number }> {
  const where: Prisma.CertificationWhereInput = {};

  if (query) {
    where.OR = [
      { certificateId: { contains: query, mode: "insensitive" } },
      { issuingBody: { contains: query, mode: "insensitive" } },
      { passport: { batchId: { contains: query, mode: "insensitive" } } },
    ];
  }
  if (filters.certVerificationStatuses && filters.certVerificationStatuses.length > 0) {
    where.verificationStatus = { in: filters.certVerificationStatuses as CertificationVerificationStatus[] };
  }
  if (dateFrom || dateTo) {
    where.validUntil = { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) };
  }
  if (tierManufacturerIds) {
    where.passport = { manufacturerId: { in: tierManufacturerIds } };
  }

  const [count, rows] = await Promise.all([
    prisma.certification.count({ where }),
    prisma.certification.findMany({
      where,
      orderBy: { validUntil: "desc" },
      take: limit,
      select: {
        id: true,
        scheme: true,
        certificateId: true,
        issuingBody: true,
        validUntil: true,
        verificationStatus: true,
        passport: { select: { batchId: true, manufacturerId: true } },
      },
    }),
  ]);

  const items: SearchResultItem[] = rows.map((c) => {
    const badges: SearchResultBadge[] = [{ label: c.verificationStatus, tone: verificationTone(c.verificationStatus) }];
    const tier = getExpiryAlertTier(c.validUntil);
    const tone = expiryTone(tier);
    if (tier && tone) badges.push({ label: tier.replace(/_/g, " "), tone });
    return {
      id: c.id,
      entityType: "CERTIFICATE",
      title: `${c.scheme} · ${c.certificateId}`,
      subtitle: `Batch ${c.passport.batchId} · issued by ${c.issuingBody}`,
      badges,
      href: `/admin#batch-row-${encodeURIComponent(c.passport.batchId)}`,
      timestamp: c.validUntil.toISOString(),
    };
  });

  return { items, count };
}

async function searchSuppliers(
  query: string,
  filters: GlobalSearchFilters,
  tierManufacturerIds: string[] | undefined,
  tierByManufacturerId: Map<string, SupplierTier | "Insufficient Data">,
  limit: number
): Promise<{ items: SearchResultItem[]; count: number }> {
  const where: Prisma.ManufacturerWhereInput = {};

  if (query) {
    where.OR = [
      { legalName: { contains: query, mode: "insensitive" } },
      { vatNumber: { contains: query, mode: "insensitive" } },
      { country: { contains: query, mode: "insensitive" } },
    ];
  }
  if (tierManufacturerIds) {
    where.id = { in: tierManufacturerIds };
  }

  const [count, rows] = await Promise.all([
    prisma.manufacturer.count({ where }),
    prisma.manufacturer.findMany({
      where,
      orderBy: { legalName: "asc" },
      take: limit,
      select: { id: true, legalName: true, country: true, vatNumber: true, createdAt: true },
    }),
  ]);

  const items: SearchResultItem[] = rows.map((m) => {
    const tier = tierByManufacturerId.get(m.id);
    const badges: SearchResultBadge[] = tier ? [{ label: tier, tone: tierTone(tier) }] : [];
    return {
      id: m.id,
      entityType: "SUPPLIER",
      title: m.legalName,
      subtitle: [m.country, m.vatNumber].filter(Boolean).join(" · ") || "No country/VAT on file",
      badges,
      href: `/admin/suppliers#supplier-row-${encodeURIComponent(m.id)}`,
      timestamp: m.createdAt.toISOString(),
    };
  });

  return { items, count };
}

async function searchAuditLogs(
  query: string,
  filters: GlobalSearchFilters,
  dateFrom: Date | undefined,
  dateTo: Date | undefined,
  tierManufacturerIds: string[] | undefined,
  limit: number
): Promise<{ items: SearchResultItem[]; count: number }> {
  const where: Prisma.AuditLogWhereInput = {};

  // Mirrors audit-log-service.ts's buildAuditLogWhere exactly — actor and
  // the related passport's batchId, never the `action` enum column, which
  // is filtered separately below (see that file's own comment on why
  // action isn't free-text matched).
  if (query) {
    where.OR = [
      { actor: { contains: query, mode: "insensitive" } },
      { passport: { batchId: { contains: query, mode: "insensitive" } } },
    ];
  }
  if (filters.auditActions && filters.auditActions.length > 0) {
    where.action = { in: filters.auditActions as AuditAction[] };
  }
  if (dateFrom || dateTo) {
    where.createdAt = { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) };
  }
  if (tierManufacturerIds) {
    where.passport = { manufacturerId: { in: tierManufacturerIds } };
  }

  const [count, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { sequence: "desc" },
      take: limit,
      select: {
        id: true,
        action: true,
        actor: true,
        createdAt: true,
        passport: { select: { batchId: true } },
      },
    }),
  ]);

  const items: SearchResultItem[] = rows.map((entry) => ({
    id: entry.id,
    entityType: "AUDIT_LOG",
    title: entry.action.replace(/_/g, " "),
    subtitle: `${entry.actor} · Batch ${entry.passport.batchId}`,
    badges: [{ label: entry.action.replace(/_/g, " "), tone: actionTone(entry.action) }],
    href: `/admin/audit?batchId=${encodeURIComponent(entry.passport.batchId)}`,
    timestamp: entry.createdAt.toISOString(),
  }));

  return { items, count };
}
