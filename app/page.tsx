/**
 * app/page.tsx — Home
 * -----------------------------------------------------------------------
 * Access-control audit (2026-09-30): Home stays publicly readable, but it is
 * read-only for everyone except an active ADMIN session. This thin Server
 * Component resolves the viewer's role on the server and hands the client
 * console a single boolean, so management controls are never rendered (not
 * even briefly) for guests, auditors or customers.
 *
 * This is the UX layer only. The real enforcement is server-side:
 *   - every mutation Server Action calls requireAdminSession() itself;
 *   - GET /api/passports returns only the public projection (issued /
 *     revoked / superseded passports, verified certificates and verified
 *     chain-of-custody records) to anyone who is not ADMIN/AUDITOR/MANUFACTURER;
 *   - exports and label sheets require an authorized session or API key.
 *
 * force-dynamic: the output depends on the request's session cookie.
 */

import { getSessionActor } from "@/lib/session-auth";
import CompletePolymerDPP from "./home-console";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const actor = await getSessionActor();
  return <CompletePolymerDPP canManage={actor?.role === "ADMIN"} />;
}
