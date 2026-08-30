/**
 * scripts/set-admin-password.ts
 * -----------------------------------------------------------------------
 * CLI provisioning script for the Production Readiness follow-up — Real
 * Admin Login & Session Wall for /admin. Sets or replaces AdminUser.
 * passwordHash for an existing admin row — a lost/forgotten password, or a
 * routine rotation. Mirrors scripts/set-auditor-password.ts exactly, one
 * level simpler (AdminUser has no apiKeyHash/organization fields to leave
 * untouched — there's nothing else on the row to accidentally disturb).
 *
 * Usage:
 *   npx tsx scripts/set-admin-password.ts --email reza@example.com --password "..."
 *   npx tsx scripts/set-admin-password.ts --id <admin-uuid> --password "..."
 *
 * or interactively (flags omitted -> prompts on stdin):
 *   npx tsx scripts/set-admin-password.ts
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
      email = (await rl.question("Admin email: ")).trim();
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
    console.error("Provide --id or --email to identify the admin.");
    process.exitCode = 1;
    return;
  }
  if (!password) {
    console.error("--password is required.");
    process.exitCode = 1;
    return;
  }

  const admin = id
    ? await prisma.adminUser.findUnique({ where: { id } })
    : await prisma.adminUser.findUnique({ where: { email } });

  if (!admin) {
    console.error("No matching admin found. Use scripts/create-admin.ts to create one.");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.adminUser.update({ where: { id: admin.id }, data: { passwordHash } });

  console.log(`\nPassword set for ${admin.name} (${admin.email}).`);
  console.log("They can now sign in at /login and will be routed to the Admin Console (/admin).");
}

main()
  .catch((err) => {
    console.error("set-admin-password failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
