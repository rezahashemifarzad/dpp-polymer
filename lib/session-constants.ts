/**
 * lib/session-constants.ts
 * -----------------------------------------------------------------------
 * Just the session cookie name — split out of lib/session-auth.ts into its
 * own zero-dependency module specifically so middleware.ts (which runs on
 * the Edge runtime) can import it without pulling in lib/session-auth.ts's
 * other imports (@/lib/prisma, next/headers, next/navigation) into the
 * Edge bundle. Prisma Client in particular is not Edge-compatible, and
 * Next.js bundles a middleware file's entire static import graph — so
 * middleware.ts must import ONLY this constant, never lib/session-auth.ts
 * itself.
 */

export const SESSION_COOKIE_NAME = "dpp_session";
