/**
 * lib/prisma.ts
 * -----------------------------------------------------------------------
 * Standard Next.js Prisma singleton pattern. Without this, every hot
 * reload in dev spins up a new PrismaClient and eventually exhausts
 * Postgres connections — the globalThis cache avoids that.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
