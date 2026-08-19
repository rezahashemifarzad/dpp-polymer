/**
 * lib/prisma.ts
 * -----------------------------------------------------------------------
 * Singleton Prisma Client for the Neon Postgres connection.
 *
 * Next.js hot-reloads modules in dev, which — without this guard — would
 * construct a brand new PrismaClient (and a brand new connection pool) on
 * every file save, eventually exhausting Neon's connection limit. We stash
 * the instance on `globalThis` in non-production environments so it
 * survives module reloads.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
