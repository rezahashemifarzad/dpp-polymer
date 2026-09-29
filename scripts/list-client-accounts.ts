/**
 * scripts/list-client-accounts.ts
 * -----------------------------------------------------------------------
 * Read-only diagnostic for /admin/accounts. Prints every Client (buyer)
 * row exactly as lib/services/manage-client-accounts.ts's
 * listClientAccounts() fetches it — same table, no filter, no limit, same
 * createdAt-desc order — so the count here is the count the Accounts page
 * must show. If a sample buyer is missing from this list, it is missing
 * from the database, not hidden by the UI; create it with:
 *
 *   npx tsx scripts/seed-sample-passports.ts --clients-only
 *
 * Usage:
 *   npx tsx scripts/list-client-accounts.ts
 *
 * Writes nothing. Never prints password hashes or API key hashes.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SAMPLE_BUYER_EMAILS = ["einkauf@rhein-pack.example.de", "procurement@automold-systeme.example.de"];

async function main() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, companyName: true, contactEmail: true, country: true, active: true, createdAt: true },
  });

  console.log(`Client (buyer) accounts in the database: ${clients.length} (${clients.filter((c) => c.active).length} active)\n`);
  for (const c of clients) {
    console.log(
      `  ${c.active ? "ACTIVE  " : "INACTIVE"}  ${c.companyName}  <${c.contactEmail ?? "no email"}>  ${c.country ?? "—"}  created ${c.createdAt.toISOString().slice(0, 10)}  id ${c.id}`
    );
  }

  const present = new Set(clients.map((c) => c.contactEmail));
  const missing = SAMPLE_BUYER_EMAILS.filter((e) => !present.has(e));
  if (missing.length > 0) {
    console.log(`\nMissing sample buyer(s): ${missing.join(", ")}`);
    console.log("Create them with: npx tsx scripts/seed-sample-passports.ts --clients-only");
  } else {
    console.log("\nBoth German sample buyers (Rhein-Pack, AutoMold) are present.");
  }
}

main()
  .catch((err) => {
    console.error("list-client-accounts failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
