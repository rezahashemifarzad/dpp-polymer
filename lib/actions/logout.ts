"use server";

/**
 * lib/actions/logout.ts
 * -----------------------------------------------------------------------
 * Server Action backing the "Sign Out" button on /portal/auditor and
 * /portal/customer. Deletes only the current tab/device's Session row (see
 * lib/session-auth.ts's destroySession() for why) and redirects to /login.
 */

import { redirect } from "next/navigation";
import { destroySession } from "@/lib/session-auth";

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
