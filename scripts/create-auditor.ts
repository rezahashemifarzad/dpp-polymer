/**
 * scripts/create-auditor.ts
 * -----------------------------------------------------------------------
 * CLI provisioning script for the Third-Party Auditor Verification
 * Workflow: creates a new Auditor row and generates its personal API key.
 *
 * The raw key is printed to stdout EXACTLY ONCE and is never stored or
 * recoverable afterward — only its SHA-256 hash (Auditor.apiKeyHash) is
 * persisted, via lib/auditor-auth.ts's hashAuditorKey (same hash function
 * app/api/passports/[batchId]/verify/route.ts uses to look the key back
 * up), so this script and the runtime auth path can never drift on how a
 * key is hashed. If a key is lost, run this script again for a fresh
 * key/Auditor row, or (to keep the same identity while rotating) update
 * the existing row's apiKeyHash directly in Neon and deactivate the old
 * key's row via `active: false`.
 *
 * Usage:
 *   npx tsx scripts/create-auditor.ts --name "Jane Doe" --org "TÜV Rheinland" [--email jane@tuv.example]
 *
 * or interactively (flags omitted -> prompts on stdin):
 *   npx tsx scripts/create-auditor.ts
 */

import "dotenv/config";
import { randomBytes, createHash } from "crypto";
import * as readline from "readline/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Mirrors lib/auditor-auth.ts's hashAuditorKey exactly. Duplicated here
// (rather than imported) deliberately: this script runs standalone via
// `tsx` outside the Next.js module graph, and lib/auditor-auth.ts also
// pulls in @/lib/prisma's app-configured client plus next/server's
// NextResponse — neither of which this CLI context needs or can cleanly
// resolve via the "@/" path alias. The algorithm (SHA-256 hex digest) is
// simple enough that keeping both in sync by inspection is low-risk; if
// that ever stops being true, extract a shared zero-dependency hash-only
// helper both can import.
function hashAuditorKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

function generateRawKey(): string {
  // 32 random bytes = 256 bits of entropy, hex-encoded (64 chars) — plenty
  // for a bearer token that's never brute-forceable in any practical sense.
  return randomBytes(32).toString("hex");
}

function parseArgs(argv: string[]): { name?: string; org?: string; email?: string } {
  const out: { name?: string; org?: string; email?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--name") out.name = value;
    if (flag === "--org") out.org = value;
    if (flag === "--email") out.email = value;
  }
  return out;
}

async function promptMissing(partial: { name?: string; org?: string; email?: string }) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const name = partial.name ?? (await rl.question("Auditor name: ")).trim();
    const organization = partial.org ?? (await rl.question("Organization: ")).trim();
    const emailRaw = partial.email ?? (await rl.question("Email (optional, press Enter to skip): ")).trim();
    return { name, organization, email: emailRaw || undefined };
  } finally {
    rl.close();
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const { name, organization, email } = await promptMissing(parsed);

  if (!name || !organization) {
    console.error("Both --name and --org (organization) are required.");
    process.exitCode = 1;
    return;
  }

  const rawKey = generateRawKey();
  const apiKeyHash = hashAuditorKey(rawKey);

  const auditor = await prisma.auditor.create({
    data: { name, organization, email, apiKeyHash, active: true },
  });

  console.log("\nAuditor created:");
  console.log(`  id:           ${auditor.id}`);
  console.log(`  name:         ${auditor.name}`);
  console.log(`  organization: ${auditor.organization}`);
  console.log(`  email:        ${auditor.email ?? "(none)"}`);
  console.log("\nPersonal API key (shown ONCE — save it now, it cannot be recovered later):\n");
  console.log(`  ${rawKey}\n`);
  console.log(
    "Give this key to the auditor to paste into the Auditor Portal (/auditor) sign-in screen.\n" +
      "It is sent as the x-dpp-auditor-key header on every request they make from that portal."
  );
}

main()
  .catch((err) => {
    console.error("create-auditor failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
