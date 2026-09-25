/**
 * app/admin/notifications/page.tsx
 * -----------------------------------------------------------------------
 * Phase 7 - Step 1: Automated Notification & Webhook Suite — dedicated
 * admin page. A Server Component — fetches the initial overview summary,
 * webhook endpoint list, and notification settings directly from the
 * service layer (lib/services/notification-service.ts,
 * lib/services/webhook-endpoints.ts, lib/services/notification-settings.ts),
 * mirroring app/admin/audit/page.tsx's own "SSR the first paint, hand off
 * to a client dashboard for interactivity" pattern rather than a client-only
 * fetch-on-mount page.
 *
 * force-dynamic: pending alerts, delivery history, and webhook health are
 * all live state that must never be served from a stale build-time cache —
 * same reasoning as every other /admin/* page in this app.
 *
 * Bug fix — "useToast must be used within a ToastProvider" crash: this
 * page renders NotificationCenterDashboard, which calls useToast() (see
 * lib/hooks/use-toast.tsx) unconditionally on every render to report
 * mutation results. Unlike app/page.tsx and app/admin/page.tsx — which
 * each wrap their own tree in a local <ToastProvider> — this page had no
 * provider anywhere above it (there is no global one in app/layout.tsx
 * either), so the context lookup threw immediately on first render.
 * Wrapped here in <ToastProvider>, matching the same established per-page
 * pattern those two pages already use, rather than adding a new global
 * provider. ToastProvider is itself a client component ("use client" in
 * lib/hooks/use-toast.tsx), so it renders fine as a child of this async
 * Server Component — same as any other client component boundary.
 */

import { computeNotificationCenterSummary } from "@/lib/services/notification-service";
import { listWebhookEndpoints } from "@/lib/services/webhook-endpoints";
import { getNotificationSettings } from "@/lib/services/notification-settings";
import { NotificationCenterDashboard } from "@/components/dashboard/notification-center-dashboard";
import { ToastProvider } from "@/lib/hooks/use-toast";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const [summary, webhooks, settings] = await Promise.all([
    computeNotificationCenterSummary(),
    listWebhookEndpoints(),
    getNotificationSettings(),
  ]);

  return (
    <ToastProvider>
      <NotificationCenterDashboard initialSummary={summary} initialWebhooks={webhooks} initialSettings={settings} />
    </ToastProvider>
  );
}
