"use server";

/**
 * lib/actions/get-viewer-role.ts
 * -----------------------------------------------------------------------
 * Access-control audit (2026-09-30). Lets client components that live in
 * the (statically rendered) root layout — currently components/SiteNav.tsx —
 * learn the viewer's role so they can hide links to areas the viewer cannot
 * use. Returns only the role name, never ids, emails or other session data.
 *
 * UX only: hiding a link is not a security boundary. /admin/* is enforced
 * by app/admin/layout.tsx (requireAdminSession) and every admin Server
 * Action / API route re-checks the session itself.
 */

import { getSessionActor, type ViewerRole } from "@/lib/session-auth";

export async function getViewerRoleAction(): Promise<ViewerRole | null> {
  try {
    const actor = await getSessionActor();
    return actor?.role ?? null;
  } catch {
    // A transient DB error must never make navigation look privileged.
    return null;
  }
}
