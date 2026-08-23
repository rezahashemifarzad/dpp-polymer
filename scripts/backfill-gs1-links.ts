/**
 * scripts/backfill-gs1-links.ts
 * -----------------------------------------------------------------------
 * One-off data fix: recomputes and updates `qrCodePayloadUrl` on every
 * PolymerPassport row using lib/qr.ts's buildGs1VerificationUrl — the same
 * function the live create-passport flow uses. Needed because
 * NEXT_PUBLIC_BASE_URL was never set in the Vercel production environment,
 * so buildGs1VerificationUrl fell back to its dev default
 * (http://localhost:3000) for every passport created before that env var
 * is set. Setting the env var only fixes *new* passports going forward —
 * rows already written to Neon still have the stale localhost URL baked
 * in, which this script corrects in place.
 *
 * DOES NOT touch recordHash, gtin, batchId, or anything else — the record
 * hash is computed over the passport's claim data, not its resolver URL
 * (see lib/verifyPassport.ts), so recomputing qrCodePayloadUrl here cannot
 * invalidate integrityVerified for any existing passport.
 *
 * Usage (run locally, once, AFTER you've set NEXT_PUBLIC_BASE_URL to your
 * real production domain in Vercel — this script talks directly to Neon
 * via DATABASE_URL, so it does not need Vercel itself to be redeployed
 * first):
 *
 *   NEXT_PUBLIC_BASE_URL=https://your-real-domain.example npx tsx scripts/backfill-gs1-links.ts
 *
 * Safe to re-run — it's idempotent (recomputes the same value if nothing
 * changed) and only ever touches qrCodePayloadUrl.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { buildGs1VerificationUrl } from "../lib/qr";

const prisma = new PrismaClient();

async function main() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!baseUrl || baseUrl.includes("localhost")) {
    console.error(
      "Refusing to run: NEXT_PUBLIC_BASE_URL is not set to a real production domain " +
        `(currently: ${baseUrl ?? "unset"}). Re-run as:\n` +
        "  NEXT_PUBLIC_BASE_URL=https://your-real-domain.example npx tsx scripts/backfill-gs1-links.ts"
    );
    process.exitCode = 1;
    return;
  }

  const passports = await prisma.polymerPassport.findMany({
    select: { id: true, batchId: true, gtin: true, recordHash: true, qrCodePayloadUrl: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const p of passports) {
    if (!p.recordHash) {
      console.warn(`Skipping ${p.batchId} — no recordHash yet (passport was never signed/hashed).`);
      skipped++;
      continue;
    }

    let url: string;
    try {
      ({ url } = buildGs1VerificationUrl(p.gtin, p.batchId, p.recordHash));
    } catch (err) {
      console.warn(`Skipping ${p.batchId} — could not rebuild GS1 link: ${(err as Error).message}`);
      skipped++;
      continue;
    }

    if (url === p.qrCodePayloadUrl) {
      skipped++;
      continue;
    }

    await prisma.polymerPassport.update({
      where: { id: p.id },
      data: { qrCodePayloadUrl: url },
    });
    console.log(`Updated ${p.batchId}: ${p.qrCodePayloadUrl ?? "(none)"} -> ${url}`);
    updated++;
  }

  console.log(`\nDone. ${updated} updated, ${skipped} skipped (already correct or not eligible).`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
