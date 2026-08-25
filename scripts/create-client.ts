/**
 * scripts/create-client.ts
 * -----------------------------------------------------------------------
 * CLI provisioning script for the B2B Client Portal & Buyer API Access
 * feature: creates a new Client (buyer company) row and generates its
 * API key. Mirrors scripts/create-auditor.ts's structure and trade-offs
 * exactly — see that file's own comments for the full rationale (raw key
 * shown once, hash-only storage, standalone `tsx` execution so it
 * duplicates the hash function rather than importing lib/client-auth.ts).
 *
 * Usage:
 *   npx tsx scripts/create-client.ts --company "Acme Packaging GmbH" --country Germany [--email buyer@acme.example] [--password "..."]
 *
 * or interactively (flags omitted -> prompts on stdin):
 *   npx tsx scripts/create-client.ts
 *
 * --password (Role-Based Authentication & Client/Auditor Portal Suite,
 * optional): sets Client.passwordHash so this buyer can also sign in at
 * /login for the new session-based /portal/customer view, in addition to
 * (not instead of) their company API key above. Requires --email — /login
 * signs in by email. Omit to leave passwordHash null; add one later via
 * scripts/set-client-password.ts.
 */

import "dotenv/config";
import { randomBytes, createHash } from "crypto";
import * as readline from "readline/promises";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

// Mirrors lib/client-auth.ts's hashClientKey exactly — see
// scripts/create-auditor.ts's file banner for why this is duplicated
// rather than imported.
function hashClientKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

function generateRawKey(): string {
  return randomBytes(32).toString("hex");
}

function parseArgs(argv: string[]): { company?: string; country?: string; email?: string; password?: string } {
  const out: { company?: string; country?: string; email?: string; password?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--company") out.company = value;
    if (flag === "--country") out.country = value;
    if (flag === "--email") out.email = value;
    if (flag === "--password") out.password = value;
  }
  return out;
}

async function promptMissing(partial: { company?: string; country?: string; email?: string; password?: string }) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const companyName = partial.company ?? (await rl.question("Buyer company name: ")).trim();
    const countryRaw = partial.country ?? (await rl.question("Country (optional, press Enter to skip): ")).trim();
    const emailRaw = partial.email ?? (await rl.question("Contact email (optional, press Enter to skip): ")).trim();
    const passwordRaw =
      partial.password ??
      (await rl.question("Password for /login sign-in (optional, press Enter to skip): ")).trim();
    return { companyName, country: countryRaw || undefined, email: emailRaw || undefined, password: passwordRaw || undefined };
  } finally {
    rl.close();
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const { companyName, country, email, password } = await promptMissing(parsed);

  if (!companyName) {
    console.error("--company (the buyer's company name) is required.");
    process.exitCode = 1;
    return;
  }
  if (password && !email) {
    console.error("--email is required when setting --password — /login signs in by email.");
    process.exitCode = 1;
    return;
  }

  const rawKey = generateRawKey();
  const apiKeyHash = hashClientKey(rawKey);
  const passwordHash = password ? await hashPassword(password) : undefined;

  const client = await prisma.client.create({
    data: { companyName, country, contactEmail: email, apiKeyHash, active: true, passwordHash },
  });

  console.log("\nClient created:");
  console.log(`  id:      ${client.id}`);
  console.log(`  company: ${client.companyName}`);
  console.log(`  country: ${client.country ?? "(none)"}`);
  console.log(`  email:   ${client.contactEmail ?? "(none)"}`);
  console.log("\nAPI key (shown ONCE — save it now, it cannot be recovered later):\n");
  console.log(`  ${rawKey}\n`);
  console.log(
    "Give this key to the buyer to paste into the B2B Client Portal (/client-portal) sign-in screen,\n" +
      "or to their ERP integration as the x-dpp-client-key header on requests to /api/v1/client/*.\n" +
      `Next, allocate their purchased batches: npx tsx scripts/allocate-passport-to-client.ts --client ${client.id} --batch <batchId>`
  );
  if (passwordHash) {
    console.log(
      `\nA password was also set — ${email} can sign in at /login to view the read-only Customer Portal (/portal/customer).`
    );
  } else {
    console.log(
      "\nNo password was set — this buyer cannot yet sign in at /login. Run scripts/set-client-password.ts to add one later."
    );
  }
}

main()
  .catch((err) => {
    console.error("create-client failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
