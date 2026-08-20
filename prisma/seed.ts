/**
 * prisma/seed.ts
 * -----------------------------------------------------------------------
 * Creates one demo Manufacturer so the "Issue New Polymer Passport" form
 * has a real manufacturerId to submit against — there was previously no
 * way to get one, which is a likely cause of 400/404s on that field.
 * Safe to run repeatedly: upserts on vatNumber, so it won't duplicate.
 *
 * Run with:
 *   npx prisma db seed
 *
 * Wiring (pick whichever matches your installed Prisma major version):
 *   Prisma 5.x — add to package.json:
 *     "prisma": { "seed": "tsx prisma/seed.ts" }
 *   and install the runner: npm install -D tsx
 *
 *   Prisma 6.x — point prisma.config.ts at it instead:
 *     migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" }
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const manufacturer = await prisma.manufacturer.upsert({
    where: { vatNumber: "DEMO-VAT-0001" },
    update: {},
    create: {
      legalName: "Demo Polymer Compounder GmbH",
      vatNumber: "DEMO-VAT-0001",
      gln: "4012345000006",
      country: "DE",
    },
  });

  console.log("Demo manufacturer ready:");
  console.log(`  id:        ${manufacturer.id}`);
  console.log(`  legalName: ${manufacturer.legalName}`);
  console.log('Paste that id into "Manufacturer ID (UUID)" in the Issue New Polymer Passport form.');
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
