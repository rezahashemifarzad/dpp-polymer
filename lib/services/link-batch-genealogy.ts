/**
 * lib/services/link-batch-genealogy.ts
 * -----------------------------------------------------------------------
 * Links an existing PolymerPassport as an upstream "parent" of another
 * existing PolymerPassport (the "child"). See
 * docs/CIRCULAR_ECONOMY_PLATFORM_UPGRADE_SPEC.md §1.1/§2.1.
 *
 * Cycle prevention: a batch can never end up as its own ancestor, or the
 * public lineage tree (and any future recursive query over this graph)
 * would recurse forever. Enforced here by walking the proposed parent's
 * own ancestor chain and rejecting if the target child already appears
 * in it — Postgres has no native "no cycles in this graph" constraint,
 * so this has to be application logic.
 */

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

type ZodFlatten = { formErrors: string[]; fieldErrors: Record<string, string[]> };

export type LinkBatchGenealogyResult =
  | { ok: true; status: 201; data: { id: string; parentPassportId: string; childPassportId: string } }
  | { ok: false; status: 400; error: string; issues?: ZodFlatten }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: 409; error: string };

export interface LinkBatchGenealogyInput {
  parentBatchId: string;
  quantityUsedKg?: number;
  notes?: string;
}

/** Walks `startPassportId`'s ancestor chain; true if `targetId` is found in it. */
async function isAncestor(targetId: string, startPassportId: string, depthLimit = 20): Promise<boolean> {
  let frontier = [startPassportId];
  const visited = new Set<string>();

  for (let depth = 0; depth < depthLimit && frontier.length > 0; depth++) {
    if (frontier.includes(targetId)) return true;

    const links = await prisma.batchGenealogyLink.findMany({
      where: { childPassportId: { in: frontier } },
      select: { parentPassportId: true },
    });

    frontier = links.map((l) => l.parentPassportId).filter((id) => !visited.has(id));
    frontier.forEach((id) => visited.add(id));
  }

  return false;
}

export async function linkBatchGenealogy(
  childBatchId: string,
  rawInput: LinkBatchGenealogyInput,
  actor: string
): Promise<LinkBatchGenealogyResult> {
  const { parentBatchId, quantityUsedKg, notes } = rawInput;

  if (!parentBatchId || typeof parentBatchId !== "string") {
    return { ok: false, status: 400, error: "parentBatchId is required" };
  }
  if (parentBatchId === childBatchId) {
    return { ok: false, status: 400, error: "A batch cannot be linked as its own parent" };
  }
  if (quantityUsedKg !== undefined && (!Number.isFinite(quantityUsedKg) || quantityUsedKg < 0)) {
    return { ok: false, status: 400, error: "quantityUsedKg must be a non-negative number" };
  }

  const [child, parent] = await Promise.all([
    prisma.polymerPassport.findUnique({ where: { batchId: childBatchId }, select: { id: true } }),
    prisma.polymerPassport.findUnique({ where: { batchId: parentBatchId }, select: { id: true } }),
  ]);

  if (!child) {
    return { ok: false, status: 404, error: `No passport found for batchId "${childBatchId}"` };
  }
  if (!parent) {
    return { ok: false, status: 404, error: `No parent passport found for batchId "${parentBatchId}"` };
  }

  const existing = await prisma.batchGenealogyLink.findUnique({
    where: { parentPassportId_childPassportId: { parentPassportId: parent.id, childPassportId: child.id } },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, status: 409, error: `Batch "${parentBatchId}" is already linked as a parent of "${childBatchId}"` };
  }

  // Reject if the proposed parent already has the child somewhere in ITS
  // own ancestor chain — linking it would create a cycle.
  if (await isAncestor(child.id, parent.id)) {
    return {
      ok: false,
      status: 409,
      error: `Cannot link "${parentBatchId}" as a parent of "${childBatchId}" — it would create a cycle in the batch genealogy`,
    };
  }

  const created = await prisma.$transaction(async (tx) => {
    const link = await tx.batchGenealogyLink.create({
      data: {
        parentPassportId: parent.id,
        childPassportId: child.id,
        quantityUsedKg: quantityUsedKg ?? null,
        notes: notes ?? null,
      },
    });

    await writeAuditLog(tx, {
      passportId: child.id,
      action: "GENEALOGY_LINKED",
      actor,
      previousHash: null,
      newHash: null,
      metadata: { parentBatchId, quantityUsedKg: quantityUsedKg ?? null },
    });

    return link;
  });

  return {
    ok: true,
    status: 201,
    data: { id: created.id, parentPassportId: created.parentPassportId, childPassportId: created.childPassportId },
  };
}
