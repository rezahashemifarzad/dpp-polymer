/**
 * app/supplier/submit/[token]/page.tsx
 * -----------------------------------------------------------------------
 * Phase 4 - Step 2: Supplier Onboarding Portal — the public, semi-secure
 * batch submission route. The token itself is the credential (see
 * lib/supplier-invite-auth.ts); this page never trusts it client-side —
 * it's an async Server Component that just forwards the (Promise-wrapped,
 * per Next.js 16 App Router convention — see AGENTS.md) route param down
 * to the actual client form, which does its own GET
 * /api/supplier/invite/[token] resolution and renders an "invalid link"
 * state if that fails. Never cached — a revoked/expired token must stop
 * working immediately, not after some page's stale render.
 */

import { SupplierSubmissionForm } from "@/components/supplier/supplier-submission-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SupplierSubmitPage({ params }: PageProps) {
  const { token } = await params;
  return <SupplierSubmissionForm token={token} />;
}
