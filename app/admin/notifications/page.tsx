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
 */

import { computeNotificationCenterSummary } from "@/lib/services/notification-service";
import { listWebhookEndpoints } from "@/lib/services/webhook-endpoints";
import { getNotificationSettings } from "@/lib/services/notification-settings";
import { NotificationCenterDashboard } from "@/components/dashboard/notification-center-dashboard";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const [summary, webhooks, settings] = await Promise.all([
    computeNotificationCenterSummary(),
    listWebhookEndpoints(),
    getNotificationSettings(),
  ]);

  return <NotificationCenterDashboard initialSummary={summary} initialWebhooks={webhooks} initialSettings={settings} />;
}
