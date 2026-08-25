/**
 * scripts/set-client-password.ts
 * -----------------------------------------------------------------------
 * CLI provisioning script for the Role-Based Authentication & Client/
 * Auditor Portal Suite: sets or replaces Client.passwordHash for an
 * existing buyer row. Mirrors scripts/set-auditor-password.ts exactly —
 * see that file's own comments for the full rationale. Does NOT touch
 * apiKeyHash/active/companyName/country — the existing company-API-key
 * auth flow (lib/client-auth.ts, the /client-portal page, the Buyer API)
 * keeps working completely unaffected by this script.
 *
 * Usage:
 *   npx tsx scripts/set-client-password.ts --email buyer@acme.example --password "..."
 *   npx tsx scripts/set-client-password.ts --id <client-uuid> --password "..."
 *
 * or interactively (flags omitted -> prompts on stdin):
 *   npx tsx scripts/set-client-password.ts
 */

import "dotenv/config";
import * as readline from "readline/promises";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

function parseArgs(argv: string[]): { id?: string; email?: string; password?: string } {
  const out: { id?: string; email?: string; password?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--id") out.id = value;
    if (flag === "--email") out.email = value;
    if (flag === "--password") out.password = value;
  }
  return out;
}

async function promptMissing(partial: { id?: string; email?: string; password?: string }) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    let id = partial.id;
    let email = partial.email;
    if (!id && !email) {
      email = (await rl.question("Client contact email: ")).trim();
    }
    const password = partial.password ?? (await rl.question("New password: ")).trim();
    return { id, email: email || undefined, password };
  } finally {
    rl.close();
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const { id, email, password } = await promptMissing(parsed);

  if (!id && !email) {
    console.error("Provide --id or --email to identify the client.");
    process.exitCode = 1;
    return;
  }
  if (!password) {
    console.error("--password is required.");
    process.exitCode = 1;
    return;
  }

  const client = id
    ? await prisma.client.findUnique({ where: { id } })
    : await prisma.client.findUnique({ where: { contactEmail: email } });

  if (!client) {
    console.error("No matching client found.");
    process.exitCode = 1;
    return;
  }
  if (!client.contactEmail) {
    console.error(
      `Client ${client.id} (${client.companyName}) has no contact email on file — /login signs in by email, so set one in Neon before this password can be used.`
    );
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.client.update({ where: { id: client.id }, data: { passwordHash } });

  console.log(`\nPassword set for ${client.companyName} (${client.contactEmail}).`);
  console.log("They can now sign in at /login to view the read-only Customer Portal (/portal/customer).");
}

main()
  .catch((err) => {
    console.error("set-client-password failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
