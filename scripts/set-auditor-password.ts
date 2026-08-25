/**
 * scripts/set-auditor-password.ts
 * -----------------------------------------------------------------------
 * CLI provisioning script for the Role-Based Authentication & Client/
 * Auditor Portal Suite: sets or replaces Auditor.passwordHash for an
 * existing auditor row (created before this feature, or whose password
 * was never set via scripts/create-auditor.ts's optional --password flag).
 * Does NOT touch apiKeyHash/active/name/organization — the existing
 * personal-API-key auth flow (lib/auditor-auth.ts, the /auditor page)
 * keeps working completely unaffected by this script.
 *
 * Usage:
 *   npx tsx scripts/set-auditor-password.ts --email jane@tuv.example --password "..."
 *   npx tsx scripts/set-auditor-password.ts --id <auditor-uuid> --password "..."
 *
 * or interactively (flags omitted -> prompts on stdin):
 *   npx tsx scripts/set-auditor-password.ts
 *
 * Look up by --email (matches Auditor.email, required for /login sign-in
 * anyway) or --id. If the auditor has no email on file yet, set one
 * directly in Neon first, or update this row via --id and add an email in
 * the same operation.
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
      email = (await rl.question("Auditor email: ")).trim();
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
    console.error("Provide --id or --email to identify the auditor.");
    process.exitCode = 1;
    return;
  }
  if (!password) {
    console.error("--password is required.");
    process.exitCode = 1;
    return;
  }

  const auditor = id
    ? await prisma.auditor.findUnique({ where: { id } })
    : await prisma.auditor.findUnique({ where: { email } });

  if (!auditor) {
    console.error("No matching auditor found.");
    process.exitCode = 1;
    return;
  }
  if (!auditor.email) {
    console.error(
      `Auditor ${auditor.id} (${auditor.name}) has no email on file — /login signs in by email, so set one in Neon before this password can be used.`
    );
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.auditor.update({ where: { id: auditor.id }, data: { passwordHash } });

  console.log(`\nPassword set for ${auditor.name} (${auditor.email}).`);
  console.log("They can now sign in at /login to view the read-only Auditor Portal (/portal/auditor).");
}

main()
  .catch((err) => {
    console.error("set-auditor-password failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
