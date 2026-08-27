/**
 * scripts/set-manufacturer-key.ts
 * -----------------------------------------------------------------------
 * CLI provisioning script for the ERP / Automated Batch Intake
 * Integration: generates a fresh ERP API key for an EXISTING Manufacturer
 * row and stores its SHA-256 hash (Manufacturer.apiKeyHash). Unlike
 * scripts/create-auditor.ts, this never creates a new Manufacturer —
 * manufacturers already exist from ordinary passport creation
 * (Manufacturer has no standalone "create" flow of its own), so this
 * script only ever looks one up and attaches ERP credentials to it.
 *
 * The raw key is printed to stdout EXACTLY ONCE and is never stored or
 * recoverable afterward — only its hash is persisted, via
 * lib/erp-auth.ts's hashManufacturerKey (same hash function
 * app/api/erp/passports/route.ts uses to look the key back up), so this
 * script and the runtime auth path can never drift on how a key is
 * hashed. Running this again for the same manufacturer ROTATES the key —
 * the old one stops working immediately, since apiKeyHash is a single
 * column, not a list.
 *
 * Usage:
 *   npx tsx scripts/set-manufacturer-key.ts --id <manufacturer-uuid>
 *   npx tsx scripts/set-manufacturer-key.ts --vat "DE123456789"
 *
 * or interactively (flags omitted -> prompts on stdin):
 *   npx tsx scripts/set-manufacturer-key.ts
 *
 * --deactivate: instead of issuing a new key, soft-revokes the existing
 * one (apiKeyActive: false) without clearing apiKeyHash — mirrors
 * Auditor.active / Client.active's soft-revoke convention. Re-run without
 * --deactivate later to reactivate with a freshly rotated key.
 */

import "dotenv/config";
import { randomBytes, createHash } from "crypto";
import * as readline from "readline/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Mirrors lib/erp-auth.ts's hashManufacturerKey exactly. Duplicated here
// (rather than imported) deliberately — same rationale as
// scripts/create-auditor.ts's own note on this: this script runs
// standalone via `tsx` outside the Next.js module graph and doesn't need
// lib/erp-auth.ts's @/lib/prisma / next/server imports along with it.
function hashManufacturerKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

function generateRawKey(): string {
  // 32 random bytes = 256 bits of entropy, hex-encoded (64 chars) — same
  // strength as every other bearer key in this app (Auditor, Client).
  return randomBytes(32).toString("hex");
}

function parseArgs(argv: string[]): { id?: string; vat?: string; deactivate?: boolean } {
  const out: { id?: string; vat?: string; deactivate?: boolean } = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--id") out.id = value;
    if (flag === "--vat") out.vat = value;
    if (flag === "--deactivate") out.deactivate = true;
  }
  return out;
}

async function promptMissing(partial: { id?: string; vat?: string }) {
  if (partial.id || partial.vat) return partial;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const id = (await rl.question("Manufacturer id (press Enter to look up by VAT number instead): ")).trim();
    if (id) return { id };
    const vat = (await rl.question("Manufacturer VAT number: ")).trim();
    return { vat: vat || undefined };
  } finally {
    rl.close();
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const { id, vat } = await promptMissing(parsed);

  if (!id && !vat) {
    console.error("Provide --id or --vat to identify the manufacturer.");
    process.exitCode = 1;
    return;
  }

  const manufacturer = id
    ? await prisma.manufacturer.findUnique({ where: { id } })
    : await prisma.manufacturer.findUnique({ where: { vatNumber: vat } });

  if (!manufacturer) {
    console.error("No matching manufacturer found.");
    process.exitCode = 1;
    return;
  }

  if (parsed.deactivate) {
    await prisma.manufacturer.update({ where: { id: manufacturer.id }, data: { apiKeyActive: false } });
    console.log(`\nERP integration key deactivated for ${manufacturer.legalName} (${manufacturer.id}).`);
    console.log("Re-run this script without --deactivate to issue a fresh key and reactivate.");
    return;
  }

  const rawKey = generateRawKey();
  const apiKeyHash = hashManufacturerKey(rawKey);

  await prisma.manufacturer.update({
    where: { id: manufacturer.id },
    data: { apiKeyHash, apiKeyActive: true },
  });

  console.log(`\nERP integration key set for ${manufacturer.legalName} (${manufacturer.id}):`);
  console.log("\nAPI key (shown ONCE — save it now, it cannot be recovered later):\n");
  console.log(`  ${rawKey}\n`);
  console.log(
    "Give this key to the manufacturer's ERP administrator (SAP, Microsoft Dynamics, or " +
      "equivalent). It is sent as the x-dpp-manufacturer-key header on every " +
      "POST /api/erp/passports request from that system, and scopes every batch it " +
      `pushes to manufacturerId "${manufacturer.id}" — it cannot create passports for any ` +
      "other manufacturer."
  );
}

main()
  .catch((err) => {
    console.error("set-manufacturer-key failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
