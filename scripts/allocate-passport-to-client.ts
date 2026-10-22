/**
 * scripts/allocate-passport-to-client.ts
 * -----------------------------------------------------------------------
 * CLI for recording that a batch was sold/allocated to a buyer (Client),
 * making it visible in that buyer's B2B Client Portal and Buyer API.
 * Functionally equivalent to POST /api/admin/client-purchases — same
 * upsert-by-(clientId, batchId) semantics, same audit log write — for
 * cases where hitting the REST route isn't convenient (local scripting,
 * CSV import, one-off backfill).
 *
 * Deliberately reimplements (rather than imports)
 * lib/services/allocate-passport-to-client.ts's logic: that module pulls
 * in "@/lib/prisma" and "@/lib/audit" via the "@/*" tsconfig path alias,
 * which every CLI script in this repo (prisma/seed.ts,
 * scripts/backfill-gs1-links.ts, scripts/create-auditor.ts,
 * scripts/create-client.ts) already avoids in favor of relative imports
 * or direct PrismaClient usage when run standalone via `tsx` outside the
 * Next.js module graph — see scripts/create-auditor.ts's own note on this
 * exact trade-off. If this drifts from the service's behavior, that's the
 * cost of the duplication; both are small enough to keep in sync by
 * inspection.
 *
 * Usage:
 *   npx tsx scripts/allocate-passport-to-client.ts --client <clientId> --batch <batchId> [--qty 500] [--notes "PO-2026-0417"]
 *
 * or interactively (flags omitted -> prompts on stdin):
 *   npx tsx scripts/allocate-passport-to-client.ts
 */

import "dotenv/config";
import * as readline from "readline/promises";
import { createHash } from "crypto";
import { PrismaClient, Prisma, type AuditAction } from "@prisma/client";

const prisma = new PrismaClient();

// ----------------------------------------------------------------------------
// Hash-chained audit writer — duplicated byte-for-byte from lib/audit.ts's
// writeAuditLog and lib/types.ts's hashRecord (same convention as
// scripts/seed-sample-passports.ts; this CLI avoids "@/..." imports).
//
// Repository audit 2026-10-22: this script previously called
// tx.auditLog.create() directly WITHOUT sequence/entryHash/previousEntryHash.
// Both are required columns, so every run threw — and had it succeeded it
// would have forked the tamper-evident audit chain. Every AuditLog write must
// go through this chained writer.
// ----------------------------------------------------------------------------
type TxClient = Prisma.TransactionClient | PrismaClient;

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

function parseArgs(argv: string[]): { client?: string; batch?: string; qty?: string; notes?: string } {
  const out: { client?: string; batch?: string; qty?: string; notes?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--client") out.client = value;
    if (flag === "--batch") out.batch = value;
    if (flag === "--qty") out.qty = value;
    if (flag === "--notes") out.notes = value;
  }
  return out;
}

async function promptMissing(partial: { client?: string; batch?: string; qty?: string; notes?: string }) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const clientId = partial.client ?? (await rl.question("Client id: ")).trim();
    const batchId = partial.batch ?? (await rl.question("Batch id: ")).trim();
    const qtyRaw = partial.qty ?? (await rl.question("Quantity (kg, optional, press Enter to skip): ")).trim();
    const notesRaw = partial.notes ?? (await rl.question("Notes (optional, press Enter to skip): ")).trim();
    return { clientId, batchId, qty: qtyRaw || undefined, notes: notesRaw || undefined };
  } finally {
    rl.close();
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const { clientId, batchId, qty, notes } = await promptMissing(parsed);

  if (!clientId || !batchId) {
    console.error("Both --client <clientId> and --batch <batchId> are required.");
    process.exitCode = 1;
    return;
  }

  const quantityKg = qty !== undefined ? Number(qty) : undefined;
  if (qty !== undefined && (!Number.isFinite(quantityKg) || (quantityKg as number) <= 0)) {
    console.error(`--qty must be a positive number (got "${qty}").`);
    process.exitCode = 1;
    return;
  }

  const [client, passport] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.polymerPassport.findUnique({ where: { batchId } }),
  ]);

  if (!client) {
    console.error(`No client found for id "${clientId}". Run scripts/create-client.ts first.`);
    process.exitCode = 1;
    return;
  }
  if (!client.active) {
    console.error(`Client "${client.companyName}" is deactivated (active: false) — reactivate before allocating.`);
    process.exitCode = 1;
    return;
  }
  if (!passport) {
    console.error(`No passport found for batchId "${batchId}".`);
    process.exitCode = 1;
    return;
  }

  await prisma.$transaction(async (tx) => {
    const access = await tx.clientPassportAccess.upsert({
      where: { clientId_passportId: { clientId, passportId: passport.id } },
      create: {
        clientId,
        passportId: passport.id,
        quantityKg: quantityKg as Prisma.Decimal.Value | undefined,
        notes,
      },
      update: {
        quantityKg: quantityKg as Prisma.Decimal.Value | undefined,
        notes,
        purchaseDate: new Date(),
      },
    });

    await writeAuditLog(tx, {
      passportId: passport.id,
      action: "CLIENT_PURCHASE_RECORDED",
      actor: "CLI:allocate-passport-to-client",
      previousHash: null,
      newHash: null,
      metadata: { clientId, clientCompanyName: client.companyName, quantityKg: quantityKg ?? null },
    });

    console.log(
      `\nAllocated batch "${batchId}" to "${client.companyName}"` +
        (quantityKg ? ` (${quantityKg} kg)` : "") +
        ` — access record ${access.id}.`
    );
    console.log(`Visible now at /client-portal (or via GET /api/v1/client/passports) for this client's API key.`);
  });
}

main()
  .catch((err) => {
    console.error("allocate-passport-to-client failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
