/**
 * scripts/create-admin.ts
 * -----------------------------------------------------------------------
 * CLI provisioning script for the Production Readiness follow-up — Real
 * Admin Login & Session Wall for /admin. Creates a new AdminUser row with a
 * password so that person can sign in at /login and reach the Admin
 * Console (/admin), which now requires a valid ADMIN session for every
 * page under it (see app/admin/layout.tsx).
 *
 * Mirrors scripts/create-auditor.ts's shape (parse flags -> prompt for
 * anything missing -> hash -> create -> print a confirmation), but simpler:
 * there is no API key to generate here (AdminUser has no apiKeyHash — it
 * exists purely to back password login, unlike Auditor/Client, which also
 * have a separate bearer-key flow to stay backward-compatible with — see
 * that model's own comment in prisma/schema.prisma), and both email and
 * password are required up front rather than optional add-ons to an
 * existing account.
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts --name "Reza Farzad" --email reza@example.com --password "..."
 *
 * or interactively (flags omitted -> prompts on stdin):
 *   npx tsx scripts/create-admin.ts
 *
 * Run this once against production after `npx prisma db push` has synced
 * the new AdminUser model — without at least one admin row, /admin becomes
 * unreachable by anyone (by design: the whole point of this script is that
 * signing in now requires a real account).
 */

import "dotenv/config";
import * as readline from "readline/promises";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

function parseArgs(argv: string[]): { name?: string; email?: string; password?: string } {
  const out: { name?: string; email?: string; password?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--name") out.name = value;
    if (flag === "--email") out.email = value;
    if (flag === "--password") out.password = value;
  }
  return out;
}

async function promptMissing(partial: { name?: string; email?: string; password?: string }) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const name = partial.name ?? (await rl.question("Admin name: ")).trim();
    const email = partial.email ?? (await rl.question("Admin email (used to sign in at /login): ")).trim();
    const password = partial.password ?? (await rl.question("Password: ")).trim();
    return { name, email, password };
  } finally {
    rl.close();
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const { name, email, password } = await promptMissing(parsed);

  if (!name || !email || !password) {
    console.error("--name, --email, and --password are all required.");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(password);

  const admin = await prisma.adminUser.create({
    data: { name, email, passwordHash, active: true },
  });

  console.log("\nAdmin created:");
  console.log(`  id:    ${admin.id}`);
  console.log(`  name:  ${admin.name}`);
  console.log(`  email: ${admin.email}`);
  console.log(
    `\n${admin.email} can now sign in at /login with the password just set, and will be routed straight to the Admin Console (/admin).`
  );
}

main()
  .catch((err) => {
    console.error("create-admin failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
