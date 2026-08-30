/**
 * lib/services/schema-drift.ts
 * -----------------------------------------------------------------------
 * Shared detection for one specific failure mode: a Prisma query
 * referencing a column/table that exists in prisma/schema.prisma but
 * hasn't been synced to the connected database yet.
 *
 * This project has no prisma/migrations history — prisma.config.ts
 * declares a migrations path, but the folder has never actually been
 * populated (confirmed: `find prisma/migrations` returns nothing).
 * Schema changes here are applied with `npx prisma db push`, not
 * `prisma migrate deploy`. That means committing a schema change to the
 * repo does NOT get it onto a deployed database automatically — someone
 * has to run `db push` against that database's DATABASE_URL separately.
 * A query that touches a column/table added since the last `db push` on
 * a given database throws Prisma error P2021 ("table does not exist") or
 * P2022 ("column does not exist") — without this helper that surfaces as
 * an opaque 500 with no indication of what actually went wrong or how to
 * fix it (see claude/svhc-compliance-alerts-schema-drift-fix-notes.md for
 * the incident this was written for).
 *
 * Wrap a Prisma call (or a Promise.all of several) in `wrapSchemaDrift()`
 * in any read-only aggregation service likely to touch newer columns.
 * Deliberately narrow: only P2021/P2022 are recognized and re-thrown as
 * the more specific SchemaOutOfDateError below; every other error
 * (including every other Prisma error code — bad input, connection
 * failure, constraint violation, ...) passes through completely
 * unchanged, so this never masks a genuinely different failure as a
 * schema problem.
 */

import { Prisma } from "@prisma/client";

export class SchemaOutOfDateError extends Error {
  readonly prismaCode: string;
  readonly target?: string;

  constructor(prismaCode: string, target: string | undefined, cause: unknown) {
    const targetNote = target ? ` (${target})` : "";
    super(
      `Database schema is out of date${targetNote} — a query referenced a column or table that doesn't exist yet ` +
        `on the connected database (Prisma ${prismaCode}). Run "npx prisma db push" against the target ` +
        `DATABASE_URL to sync the live database with prisma/schema.prisma, then retry.`
    );
    this.name = "SchemaOutOfDateError";
    this.prismaCode = prismaCode;
    this.target = target;
    if (cause !== undefined) {
      // Node's standard Error.cause — kept for server-side log context
      // only; never surfaced to the client (see callers' catch blocks).
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

function extractTarget(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  if (typeof m.column === "string") return m.column;
  if (typeof m.table === "string") return m.table;
  return undefined;
}

/**
 * Runs `fn`, and re-throws a Prisma P2021/P2022 as a SchemaOutOfDateError
 * with a clear, actionable message. Every other error passes through
 * unchanged.
 */
export async function wrapSchemaDrift<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022")) {
      throw new SchemaOutOfDateError(error.code, extractTarget(error.meta), error);
    }
    throw error;
  }
}
