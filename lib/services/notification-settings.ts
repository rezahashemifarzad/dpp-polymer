/**
 * lib/services/notification-settings.ts
 * -----------------------------------------------------------------------
 * Phase 7 - Step 1: Automated Notification & Webhook Suite — get/update
 * for the single mutable NotificationSettings row (see that model's
 * comment in prisma/schema.prisma for the "no forced singleton id, always
 * read the first row" convention, mirroring PlasticTaxParameter elsewhere
 * in this schema).
 */

import { prisma } from "@/lib/prisma";
import type { ExpiryAlertLevel } from "@prisma/client";

export interface NotificationSettingsView {
  id: string;
  emailEnabled: boolean;
  emailRecipients: string[];
  notifyOnTiers: ExpiryAlertLevel[];
  anomalyNotificationsEnabled: boolean;
  updatedBy: string | null;
  updatedAt: string;
}

function toView(row: {
  id: string;
  emailEnabled: boolean;
  emailRecipients: string[];
  notifyOnTiers: ExpiryAlertLevel[];
  anomalyNotificationsEnabled: boolean;
  updatedBy: string | null;
  updatedAt: Date;
}): NotificationSettingsView {
  return {
    id: row.id,
    emailEnabled: row.emailEnabled,
    emailRecipients: row.emailRecipients,
    notifyOnTiers: row.notifyOnTiers,
    anomalyNotificationsEnabled: row.anomalyNotificationsEnabled,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Always returns a row — lazily creates one with schema defaults on first
 * read if the table is still empty, so every other caller in this feature
 * (the dispatcher, the admin UI) can assume a settings row always exists
 * rather than null-checking everywhere. */
export async function getNotificationSettings(): Promise<NotificationSettingsView> {
  const existing = await prisma.notificationSettings.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return toView(existing);

  const created = await prisma.notificationSettings.create({ data: {} });
  return toView(created);
}

export interface UpdateNotificationSettingsInput {
  emailEnabled?: boolean;
  emailRecipients?: string[];
  notifyOnTiers?: ExpiryAlertLevel[];
  anomalyNotificationsEnabled?: boolean;
}

const VALID_TIERS: ExpiryAlertLevel[] = ["EXPIRING_SOON", "EXPIRING_URGENT", "EXPIRED"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type UpdateNotificationSettingsResult =
  | { ok: true; status: 200; data: NotificationSettingsView }
  | { ok: false; status: 400; error: string };

export async function updateNotificationSettings(
  actor: string,
  input: UpdateNotificationSettingsInput
): Promise<UpdateNotificationSettingsResult> {
  let emailRecipients: string[] | undefined;
  if (input.emailRecipients !== undefined) {
    emailRecipients = Array.from(new Set(input.emailRecipients.map((e) => e.trim()).filter(Boolean)));
    const invalid = emailRecipients.find((e) => !EMAIL_PATTERN.test(e));
    if (invalid) {
      return { ok: false, status: 400, error: `"${invalid}" is not a valid email address` };
    }
  }

  let notifyOnTiers: ExpiryAlertLevel[] | undefined;
  if (input.notifyOnTiers !== undefined) {
    notifyOnTiers = Array.from(new Set(input.notifyOnTiers)).filter((t) => VALID_TIERS.includes(t));
    if (notifyOnTiers.length === 0) {
      return { ok: false, status: 400, error: "At least one expiry tier must be selected" };
    }
  }

  // Ensure a row exists first (getNotificationSettings's lazy-create), then
  // update that exact row — avoids a race where two concurrent first-time
  // saves each try to create their own row.
  const current = await getNotificationSettings();

  const updated = await prisma.notificationSettings.update({
    where: { id: current.id },
    data: {
      ...(input.emailEnabled !== undefined ? { emailEnabled: input.emailEnabled } : {}),
      ...(emailRecipients !== undefined ? { emailRecipients } : {}),
      ...(notifyOnTiers !== undefined ? { notifyOnTiers } : {}),
      ...(input.anomalyNotificationsEnabled !== undefined ? { anomalyNotificationsEnabled: input.anomalyNotificationsEnabled } : {}),
      updatedBy: actor,
    },
  });

  return { ok: true, status: 200, data: toView(updated) };
}
