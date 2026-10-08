/**
 * app/app/page.tsx — Platform home (/app)
 * -----------------------------------------------------------------------
 * The Material Ledger console that used to live at "/". Moved here when the
 * root path became the public corporate landing page (app/page.tsx).
 * Behaviour is unchanged from the 2026-09-30 access-control audit:
 *
 * Publicly readable, but read-only for everyone except an active ADMIN
 * session. This thin Server Component resolves the viewer's role on the
 * server and hands the client console a single boolean, so management
 * controls are never rendered (not even briefly) for guests, auditors or
 * customers.
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

import type { Metadata } from "next";
import { getSessionActor } from "@/lib/session-auth";
import CompletePolymerDPP from "../home-console";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Platform · DPP-Polymer",
  description: "Digital Product Passport Platform",
};

export default async function PlatformHomePage() {
  const actor = await getSessionActor();
  return <CompletePolymerDPP canManage={actor?.role === "ADMIN"} />;
}
