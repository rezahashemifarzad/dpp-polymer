/**
 * lib/services/form-suggestions.ts
 * -----------------------------------------------------------------------
 * Autocomplete data for key free-text/FK-lookup form fields — Polymer
 * Grade names, Manufacturer (Supplier) records, and Chain-of-Custody
 * participant names — so a user filling out the passport creation form or
 * the batch genealogy modal's Chain-of-Custody panel can pick a previous
 * entry instead of hand-typing it (or, for Manufacturer, hand-pasting a
 * UUID with no way to discover one — see create-passport-modal.tsx's own
 * file banner, item 3).
 *
 * Deliberately NOT derived from whatever page of GET /api/passports is
 * currently loaded client-side: that route is paginated (see its own
 * `skip`/`take`), so a client-side reduction over the current page would
 * silently miss grades/manufacturers/participant names that exist in the
 * database but aren't on the visible page. This queries the full,
 * unpaginated distinct sets directly, same reasoning as
 * getAuditLogFilterOptions() in audit-log-service.ts.
 *
 * Every value returned here is already public elsewhere in the app:
 * grade and manufacturer legalName/country are part of every issued
 * passport's own public QR-scan view (components/PublicScanPage.tsx), and
 * chain-of-custody participantName is rendered there too (see that
 * component's ChainOfCustodyTimeline section). So, same reasoning as GET
 * /api/audit-log and GET /api/certifications/expiry-alerts, this read is
 * intentionally left ungated — it surfaces nothing that isn't already
 * unauthenticated-readable through an existing route.
 */

import { prisma } from "@/lib/prisma";

export interface ManufacturerSuggestion {
  id: string;
  legalName: string;
  country: string;
}

export interface FormSuggestions {
  grades: string[];
  manufacturers: ManufacturerSuggestion[];
  chainOfCustodyParticipantNames: string[];
}

// Sane upper bounds so a suggestion list can never balloon into something
// that hurts the UI it's meant to keep clean — see this feature's request:
// "without cluttering the UI". A dropdown/datalist beyond a few hundred
// entries stops being useful to scan anyway.
const MAX_GRADE_SUGGESTIONS = 300;
const MAX_MANUFACTURER_SUGGESTIONS = 300;
const MAX_PARTICIPANT_NAME_SUGGESTIONS = 300;

export async function getFormSuggestions(): Promise<FormSuggestions> {
  const [gradeRows, manufacturerRows, participantRows] = await Promise.all([
    prisma.polymerPassport.findMany({
      distinct: ["grade"],
      select: { grade: true },
      orderBy: { grade: "asc" },
      take: MAX_GRADE_SUGGESTIONS,
    }),
    prisma.manufacturer.findMany({
      select: { id: true, legalName: true, country: true },
      orderBy: { legalName: "asc" },
      take: MAX_MANUFACTURER_SUGGESTIONS,
    }),
    prisma.chainOfCustodyRecord.findMany({
      distinct: ["participantName"],
      select: { participantName: true },
      orderBy: { participantName: "asc" },
      take: MAX_PARTICIPANT_NAME_SUGGESTIONS,
    }),
  ]);

  return {
    grades: gradeRows.map((r) => r.grade).filter((g): g is string => Boolean(g && g.trim())),
    manufacturers: manufacturerRows,
    chainOfCustodyParticipantNames: participantRows
      .map((r) => r.participantName)
      .filter((n): n is string => Boolean(n && n.trim())),
  };
}
