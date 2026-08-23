/**
 * lib/services/allocate-passport-to-client.ts
 * -----------------------------------------------------------------------
 * Records that a batch was sold/allocated to a Client (buyer company) —
 * the one write operation the B2B Client Portal & Buyer API feature makes
 * against existing data. Everything else that feature does (the portal,
 * the Buyer API) is read-only over what this creates.
 *
 * Called from two places, both of which just supply the actor identity:
 *   - scripts/allocate-passport-to-client.ts (CLI, for manual/local use)
 *   - app/api/admin/client-purchases/route.ts (REST, shared ADMIN role key)
 *
 * Upsert semantics: @@unique([clientId, passportId]) on
 * ClientPassportAccess means a repeat allocation of the same batch to the
 * same buyer UPDATES the existing row (e.g. correcting quantityKg or
 * notes) rather than erroring or creating a duplicate — there is exactly
 * one "how much of batch X did buyer Y purchase" answer per pair.
 */

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export interface AllocatePassportToClientInput {
  clientId: string;
  batchId: string;
  quantityKg?: number;
  notes?: string;
}

export type AllocatePassportToClientResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; error: string };

export async function allocatePassportToClient(
  input: AllocatePassportToClientInput,
  actor: string
): Promise<AllocatePassportToClientResult> {
  const { clientId, batchId, quantityKg, notes } = input;

  const [client, passport] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.polymerPassport.findUnique({ where: { batchId } }),
  ]);

  if (!client) {
    return { ok: false, status: 404, error: `No client found for id "${clientId}"` };
  }
  if (!client.active) {
    return { ok: false, status: 409, error: `Client "${client.companyName}" is deactivated — reactivate before allocating batches` };
  }
  if (!passport) {
    return { ok: false, status: 404, error: `No passport found for batchId "${batchId}"` };
  }

  try {
    const access = await prisma.$transaction(async (tx) => {
      const upserted = await tx.clientPassportAccess.upsert({
        where: { clientId_passportId: { clientId, passportId: passport.id } },
        create: {
          clientId,
          passportId: passport.id,
          quantityKg: quantityKg ?? undefined,
          notes: notes ?? undefined,
        },
        update: {
          quantityKg: quantityKg ?? undefined,
          notes: notes ?? undefined,
          purchaseDate: new Date(),
        },
      });

      await writeAuditLog(tx, {
        passportId: passport.id,
        action: "CLIENT_PURCHASE_RECORDED",
        actor,
        previousHash: null,
        newHash: null,
        metadata: {
          clientId,
          clientCompanyName: client.companyName,
          quantityKg: quantityKg ?? null,
        },
      });

      return upserted;
    });

    return { ok: true, status: 200, data: access };
  } catch (error) {
    console.error(`allocatePassportToClient(${clientId}, ${batchId}) failed:`, error);
    return { ok: false, status: 500, error: "Failed to record client purchase allocation" };
  }
}
