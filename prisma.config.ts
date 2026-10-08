// prisma.config.ts
// ---------------------------------------------------------------------------
// Fixed in the 2026-10-08 code review. This project runs Prisma 5.22, which
// does not read prisma.config.ts at all: the CLI and Prisma Client load the
// datasource URL from `env("DATABASE_URL")` in prisma/schema.prisma and the
// root .env file, and `npx prisma db seed` uses the "prisma.seed" entry in
// package.json. The previous version imported `defineConfig` from
// "prisma/config", a module that only exists from Prisma 6 onwards, so it
// failed type-checking under 5.22.
//
// This file is kept, dependency-free, so the upgrade path stays ready:
// Prisma 6+ picks up this default export automatically (defineConfig is only
// a typing helper and can be added back after upgrading). Once a config file
// is in use, Prisma 6+ no longer loads .env by itself, hence the explicit
// dotenv import.
import "dotenv/config";

const prismaConfig = {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
};

export default prismaConfig;
