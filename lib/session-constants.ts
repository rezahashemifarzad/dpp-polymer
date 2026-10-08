/**
 * lib/session-constants.ts
 * -----------------------------------------------------------------------
 * Just the session cookie name — split out of lib/session-auth.ts into its
 * own zero-dependency module specifically so proxy.ts can import it
 * without pulling lib/session-auth.ts's other imports (@/lib/prisma,
 * next/headers, next/navigation) into the proxy bundle. The proxy was an
 * Edge-runtime middleware when this was written (Next.js 16 now runs
 * proxy.ts on Node.js by default); keeping it dependency-free still keeps
 * the proxy fast and deployable to the edge, so proxy.ts must import ONLY
 * this constant, never lib/session-auth.ts itself.
 */

export const SESSION_COOKIE_NAME = "dpp_session";
