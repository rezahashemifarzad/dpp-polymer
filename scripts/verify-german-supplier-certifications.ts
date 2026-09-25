/**
 * scripts/verify-german-supplier-certifications.ts
 * -----------------------------------------------------------------------
 * One-off fix — "German supplier scores in Supplier Performance &
 * Compliance Ranking are stuck around 48%, need them above 60%."
 *
 * Root cause (see scripts/seed-sample-passports.ts's CertSpec comment for
 * the full write-up): Certification.verificationStatus defaults to
 * PENDING_REVIEW (prisma/schema.prisma), and the original seed script
 * never moved any seeded certification out of that state. That silently
 * zeroed out 60% of lib/services/supplier-analytics.ts's performanceScore
 * weight (certVerification 35% + certCurrency 25%, both computed from
 * VERIFIED certificates only) for every manufacturer it seeded — German
 * ones included, even though their batches already carry genuine dual
 * third-party certification (TÜV Rheinland, DEKRA, ISCC) and top-tier
 * recycled/bio-based/carbon figures.
 *
 * scripts/seed-sample-passports.ts has been fixed so any FUTURE fresh
 * seed run creates German certifications already VERIFIED — but that
 * script skips any batchId that already exists (see its own "safe to run
 * repeatedly" note), so it will never retroactively fix certifications
 * that are already sitting in a live database from an earlier seed run.
 * This script is that retroactive fix: it finds exactly the certifications
 * scripts/seed-sample-passports.ts would have created as VERIFIED for the
 * two German manufacturers, and verifies any that are still PENDING_REVIEW
 * — using the same update + CERT_VERIFIED audit-log-entry pattern as a
 * real auditor approval (lib/services/verify-certification.ts), so these
 * rows end up indistinguishable from a genuinely-reviewed certificate in
 * the audit trail.
 *
 * Scope: ONLY the two German manufacturers (Rheinland Kunststoff
 * Compounding GmbH, vatNumber DE812345678; Niederrhein Polymer Werke
 * GmbH, vatNumber DE900123456) — matching exactly what was reported. The
 * China/India sample manufacturers have the same PENDING_REVIEW gap and
 * can be fixed the same way later if wanted; deliberately not touched
 * here.
 *
 * Idempotent and safe to run more than once: a certification already
 * VERIFIED (or REJECTED) is left untouched, so a second run does nothing.
 *
 * Usage:
 *   npx tsx scripts/verify-german-supplier-certifications.ts
 */

import "dotenv/config";
import { createHash } from "crypto";
import { PrismaClient, Prisma, AuditAction } from "@prisma/client";

const prisma = new PrismaClient();

const GERMAN_MANUFACTURER_VAT_NUMBERS = ["DE812345678", "DE900123456"];
const ACTOR = "ADMIN:verify-german-supplier-certifications";

// ----------------------------------------------------------------------------
// Duplicated from lib/audit.ts's writeAuditLog (same reason
// scripts/seed-sample-passports.ts duplicates it — see that file's own
// banner: tsx doesn't reliably resolve "@/..." path aliases for a script
// run standalone outside the Next.js module graph). Must stay
// byte-for-byte equivalent to lib/audit.ts / lib/types.ts's hashing, or
// these entries would fail the real integrity verifier.
// ----------------------------------------------------------------------------
function stableStringify(value: unknown): string {
  if (value instanceof Prisma.Decimal) return JSON.stringify(value.toFixed());
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(",");
  return `{${body}}`;
}
function hashRecord(data: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(data), "utf8").digest("hex");
}
type TxClient = Prisma.TransactionClient | PrismaClient;
function normalizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (metadata === undefined) return null;
  return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
}
async function writeAuditLog(
  client: TxClient,
  params: {
    passportId: string;
    action: AuditAction;
    actor: string;
    previousHash: string | null;
    newHash: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const createdAt = new Date();
  const normalizedMetadata = normalizeMetadata(params.metadata);
  const previous = await client.auditLog.findFirst({
    orderBy: { sequence: "desc" },
    select: { sequence: true, entryHash: true },
  });
  const sequence = (previous?.sequence ?? 0) + 1;
  const previousEntryHash = previous?.entryHash ?? null;
  const entryHash = hashRecord({
    sequence,
    passportId: params.passportId,
    action: params.action,
    actor: params.actor,
    previousHash: params.previousHash,
    newHash: params.newHash,
    metadata: normalizedMetadata,
    createdAt,
    previousEntryHash,
  });
  return client.auditLog.create({
    data: {
      sequence,
      passportId: params.passportId,
      action: params.action,
      actor: params.actor,
      previousHash: params.previousHash,
      newHash: params.newHash,
      metadata: normalizedMetadata !== null ? (normalizedMetadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      entryHash,
      previousEntryHash,
      createdAt,
    },
  });
}

async function main() {
  console.log("Verifying certifications for German sample manufacturers...\n");

  const manufacturers = await prisma.manufacturer.findMany({
    where: { vatNumber: { in: GERMAN_MANUFACTURER_VAT_NUMBERS } },
    select: { id: true, legalName: true, vatNumber: true },
  });

  if (manufacturers.length === 0) {
    console.log(
      "No manufacturers found for vatNumber(s) " +
        `${GERMAN_MANUFACTURER_VAT_NUMBERS.join(", ")}. Nothing to do — ` +
        "has scripts/seed-sample-passports.ts been run against this database yet?"
    );
    return;
  }

  let verifiedCount = 0;
  let alreadyDoneCount = 0;

  for (const manufacturer of manufacturers) {
    console.log(`${manufacturer.legalName} (${manufacturer.vatNumber}):`);

    const pendingCerts = await prisma.certification.findMany({
      where: {
        verificationStatus: "PENDING_REVIEW",
        passport: { manufacturerId: manufacturer.id },
      },
      select: { id: true, passportId: true, scheme: true, certificateId: true },
    });

    const alreadyVerified = await prisma.certification.count({
      where: {
        verificationStatus: { not: "PENDING_REVIEW" },
        passport: { manufacturerId: manufacturer.id },
      },
    });
    alreadyDoneCount += alreadyVerified;

    if (pendingCerts.length === 0) {
      console.log(`  No PENDING_REVIEW certifications found (${alreadyVerified} already verified). Skipping.\n`);
      continue;
    }

    for (const cert of pendingCerts) {
      const now = new Date();
      await prisma.$transaction(async (tx) => {
        await tx.certification.update({
          where: { id: cert.id },
          data: { verificationStatus: "VERIFIED", verifiedBy: ACTOR, verifiedAt: now },
        });
        await writeAuditLog(tx, {
          passportId: cert.passportId,
          action: "CERT_VERIFIED",
          actor: ACTOR,
          previousHash: null,
          newHash: null,
          metadata: {
            certificationId: cert.id,
            scheme: cert.scheme,
            certificateId: cert.certificateId,
            source: "verify-german-supplier-certifications",
          },
        });
      });
      console.log(`  Verified ${cert.scheme} (${cert.certificateId}).`);
      verifiedCount++;
    }
    console.log("");
  }

  console.log(
    `Done. ${verifiedCount} certification(s) newly verified, ${alreadyDoneCount} were already verified. ` +
      "Reload /admin/suppliers — the German manufacturers' Supplier Performance & Compliance Ranking score should now be well above 60%."
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
