/**
 * lib/services/get-auditor-queue.ts
 * -----------------------------------------------------------------------
 * The shared PENDING_VERIFICATION review queue — every passport awaiting
 * an auditor's sign-off, with the certification and manufacturer data a
 * reviewer needs to actually inspect the batch.
 *
 * Extracted from app/api/auditor/queue/route.ts's own query body (Role-
 * Based Authentication & Client/Auditor Portal Suite) so that BOTH the
 * existing key-gated REST route and the new session-gated
 * app/portal/auditor/page.tsx share one implementation — mirroring
 * lib/services/get-client-portfolio.ts's own "one implementation, so
 * numbers can never drift apart" rationale. The route's URL, auth
 * (lib/auditor-auth.ts's authorizeAuditor(), unchanged), and JSON response
 * shape are all untouched by this extraction.
 *
 * Same "not auditor-specific" note as the original route's file banner:
 * every active auditor sees the same shared queue — there is no per-
 * auditor assignment/claiming concept in this MVP.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const AUDITOR_QUEUE_INCLUDE = {
  certifications: true,
  manufacturer: true,
  carbonFootprintCalculation: true,
} satisfies Prisma.PolymerPassportInclude;

export type AuditorQueuePassport = Prisma.PolymerPassportGetPayload<{ include: typeof AUDITOR_QUEUE_INCLUDE }>;

export async function getAuditorQueue(): Promise<AuditorQueuePassport[]> {
  return prisma.polymerPassport.findMany({
    where: { status: "PENDING_VERIFICATION" },
    include: AUDITOR_QUEUE_INCLUDE,
    orderBy: { productionDate: "asc" }, // oldest-awaiting-review first
  });
}
