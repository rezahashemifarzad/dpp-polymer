"use server";

/**
 * lib/actions/create-passport.ts
 * -----------------------------------------------------------------------
 * Server Action backing the in-app dashboard/admin "Create Passport" UI
 * (called from lib/hooks/use-passports.ts). This runs entirely
 * server-side — Next.js invokes it through its own internal RPC
 * mechanism when a client component calls it, never through a plain
 * `fetch()` to a public URL — so it does NOT check for, and must never
 * be given, an RBAC role key (see lib/rbac.ts, which gates the public
 * POST /api/passports route): there is no publicly-reachable URL here
 * for an outside caller to hit with a stolen or guessed key. The trust
 * boundary is "this code only runs because a Server Component/Client
 * Component in THIS app invoked it," not a bearer token.
 *
 * Calls the same lib/services/create-passport.ts logic that POST
 * /api/passports uses, so the API route and the in-app UI can never
 * drift into two different implementations again (this repo has already
 * been bitten by exactly that once — see the STEP 5 note in
 * app/api/passports/route.ts).
 */

import { createPassport, type CreatePassportResult } from "@/lib/services/create-passport";

export interface CreatePassportActionResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  issues?: { formErrors: string[]; fieldErrors: Record<string, string[]> };
}

/**
 * Server Action return values cross the server/client boundary through
 * Next.js's own React-Server-Components serialization, which does not
 * know how to send a Prisma.Decimal or class instance across the wire.
 * Round-tripping through JSON here calls each value's toJSON() (Decimal
 * and Date both have one) and guarantees the exact same plain-string
 * shape the client already expects from the JSON API — the same
 * contract the ApiPassport interface in lib/hooks/use-passports.ts is
 * written against — regardless of RSC serialization internals.
 */
function toPlainJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

export async function createPassportAction(rawInput: unknown): Promise<CreatePassportActionResult> {
  try {
    const result: CreatePassportResult = await createPassport(rawInput);
    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        issues: "issues" in result ? result.issues : undefined,
      };
    }
    return { ok: true, data: toPlainJson(result.data) };
  } catch (error) {
    console.error("createPassportAction failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to issue passport",
    };
  }
}
