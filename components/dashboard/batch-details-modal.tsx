"use client";

/**
 * components/dashboard/batch-details-modal.tsx
 * -----------------------------------------------------------------------
 * Post-creation "Manage" panel for a single passport — Batch Genealogy
 * (parent-batch linking) and the illustrative Carbon Footprint Calculator
 * (see docs/CIRCULAR_ECONOMY_PLATFORM_UPGRADE_SPEC.md §§1-2).
 *
 * Deliberately NOT folded into CreatePassportModal. Genealogy links and
 * carbon calculations both require an existing passport id (a batch can
 * only cite an *already-issued* parent, and a carbon estimate is computed
 * against a persisted polymerType), so they only ever make sense as a
 * post-creation action — exactly the same reasoning that already put
 * certifications on a separate attach-after-create endpoint rather than
 * inside the create form. Keeping this as its own modal also means the
 * creation flow (already tested, already working) stays untouched.
 *
 * Two independent panels, each posting through its own Server Action
 * (lib/actions/link-batch-genealogy.ts, lib/actions/calculate-carbon-footprint.ts)
 * via the linkParentBatch / calculateCarbonFootprint methods on
 * usePassports() — same dual-path pattern (Server Action for in-app,
 * RBAC'd REST route for external callers) used everywhere else in this
 * app.
 */

import React, { useMemo, useState } from "react";
import { X, Loader2, GitBranch, Leaf, AlertTriangle, ArrowUpRight } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import type { ApiPassport } from "@/lib/hooks/use-passports";

const TRANSPORT_MODES: Array<"TRUCK" | "RAIL" | "SEA" | "AIR"> = ["TRUCK", "RAIL", "SEA", "AIR"];

const inputCls =
  "w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-slate-400 block mb-1">{label}</span>
      {children}
    </label>
  );
}

interface BatchDetailsModalProps {
  open: boolean;
  onClose: () => void;
  passport: ApiPassport | null;
  allPassports: ApiPassport[];
  onLinkParent: (
    childBatchId: string,
    input: { parentBatchId: string; quantityUsedKg?: number; notes?: string }
  ) => Promise<unknown>;
  onCalculateCarbon: (
    batchId: string,
    input: { weightKg: number; transportDistanceKm?: number; transportMode?: "TRUCK" | "RAIL" | "SEA" | "AIR" }
  ) => Promise<unknown>;
}

export function BatchDetailsModal({
  open,
  onClose,
  passport,
  allPassports,
  onLinkParent,
  onCalculateCarbon,
}: BatchDetailsModalProps) {
  const { push } = useToast();

  const [parentBatchId, setParentBatchId] = useState("");
  const [quantityUsedKg, setQuantityUsedKg] = useState("");
  const [notes, setNotes] = useState("");
  const [linking, setLinking] = useState(false);

  const [weightKg, setWeightKg] = useState("1000");
  const [transportDistanceKm, setTransportDistanceKm] = useState("0");
  const [transportMode, setTransportMode] = useState<"TRUCK" | "RAIL" | "SEA" | "AIR">("TRUCK");
  const [calculating, setCalculating] = useState(false);

  // Eligible parents: any other ISSUED-or-later passport, excluding this
  // batch itself and anything already linked. Cycle-prevention beyond that
  // (a parent that is secretly a descendant) is enforced server-side in
  // lib/services/link-batch-genealogy.ts via an ancestor walk — this list
  // is just a convenience filter, not the source of truth.
  const eligibleParents = useMemo(() => {
    if (!passport) return [];
    const alreadyLinked = new Set(passport.parentLinks.map((l) => l.parentPassport.id));
    return allPassports.filter((p) => p.id !== passport.id && !alreadyLinked.has(p.id));
  }, [passport, allPassports]);

  if (!open || !passport) return null;

  const handleLinkParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentBatchId) return;
    setLinking(true);
    try {
      await onLinkParent(passport.batchId, {
        parentBatchId,
        quantityUsedKg: quantityUsedKg ? Number(quantityUsedKg) : undefined,
        notes: notes || undefined,
      });
      push({
        variant: "success",
        title: "Parent batch linked",
        description: `${parentBatchId} added to ${passport.batchId}'s genealogy.`,
      });
      setParentBatchId("");
      setQuantityUsedKg("");
      setNotes("");
    } catch (err) {
      push({
        variant: "error",
        title: "Could not link parent batch",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLinking(false);
    }
  };

  const handleCalculateCarbon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCalculating(true);
    try {
      await onCalculateCarbon(passport.batchId, {
        weightKg: Number(weightKg),
        transportDistanceKm: transportDistanceKm ? Number(transportDistanceKm) : undefined,
        transportMode,
      });
      push({
        variant: "success",
        title: "Carbon footprint calculated",
        description: `Illustrative Scope 1/2/3 estimate saved for ${passport.batchId}.`,
      });
    } catch (err) {
      push({
        variant: "error",
        title: "Could not calculate carbon footprint",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl p-6 relative shadow-2xl my-8">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-800"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-bold text-white mb-1">Manage Batch — {passport.batchId}</h3>
        <p className="text-xs text-slate-400 mb-4 font-mono">
          Supply-chain genealogy and an illustrative Scope 1/2/3 carbon footprint estimate for this batch.
        </p>

        {/* Batch Genealogy panel */}
        <div className="border border-slate-800 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-slate-100">Parent Batches (Supply-Chain Genealogy)</h4>
          </div>

          {passport.parentLinks.length > 0 ? (
            <ul className="space-y-1.5 mb-3 font-mono text-xs">
              {passport.parentLinks.map((link) => (
                <li
                  key={link.id}
                  className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-3 py-2"
                >
                  <span className="text-emerald-400">{link.parentPassport.batchId}</span>
                  <span className="text-slate-500">
                    {link.parentPassport.polymerType}
                    {link.quantityUsedKg ? ` · ${link.quantityUsedKg} kg used` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 font-mono mb-3">No parent batches linked yet.</p>
          )}

          <form onSubmit={handleLinkParent} className="space-y-3 font-mono text-xs">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Parent Batch">
                <select
                  required
                  value={parentBatchId}
                  onChange={(e) => setParentBatchId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— select a batch —</option>
                  {eligibleParents.map((p) => (
                    <option key={p.id} value={p.batchId}>
                      {p.batchId} ({p.polymerType})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quantity Used (kg, optional)">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={quantityUsedKg}
                  onChange={(e) => setQuantityUsedKg(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <div className="col-span-2">
                <Field label="Notes (optional)">
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
                </Field>
              </div>
            </div>
            {eligibleParents.length === 0 && (
              <div className="flex items-center gap-1.5 text-amber-400 text-[10px]">
                <AlertTriangle className="w-3 h-3" />
                No other issued batches are available to link as a parent yet.
              </div>
            )}
            <button
              type="submit"
              disabled={linking || !parentBatchId}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2"
            >
              {linking && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {linking ? "Linking..." : "Link Parent Batch"}
            </button>
          </form>
        </div>

        {/* Carbon Footprint panel */}
        <div className="border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Leaf className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-slate-100">Carbon Footprint Calculator</h4>
          </div>
          <p className="text-[10px] text-slate-500 font-mono mb-3 flex items-start gap-1.5">
            <ArrowUpRight className="w-3 h-3 mt-0.5 shrink-0" />
            Illustrative Scope 1/2/3 estimate from generic emission factors — separate from, and never
            overwrites, this batch&apos;s verified LCA figure ({passport.carbonFootprintKgCO2ePerKg} kg
            CO2e/kg).
          </p>

          {passport.carbonFootprintCalculation && (
            <div className="mb-3 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs grid grid-cols-2 gap-y-1">
              <span className="text-slate-500">Scope 1</span>
              <span className="text-slate-200 text-right">
                {passport.carbonFootprintCalculation.scope1KgCO2e} kg CO2e
              </span>
              <span className="text-slate-500">Scope 2</span>
              <span className="text-slate-200 text-right">
                {passport.carbonFootprintCalculation.scope2KgCO2e} kg CO2e
              </span>
              <span className="text-slate-500">Scope 3</span>
              <span className="text-slate-200 text-right">
                {passport.carbonFootprintCalculation.scope3KgCO2e} kg CO2e
              </span>
              <span className="text-emerald-400 font-bold">Total</span>
              <span className="text-emerald-400 font-bold text-right">
                {passport.carbonFootprintCalculation.totalKgCO2e} kg CO2e
              </span>
            </div>
          )}

          <form onSubmit={handleCalculateCarbon} className="space-y-3 font-mono text-xs">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Weight (kg)">
                <input
                  required
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Transport Distance (km)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={transportDistanceKm}
                  onChange={(e) => setTransportDistanceKm(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Transport Mode">
                <select
                  value={transportMode}
                  onChange={(e) => setTransportMode(e.target.value as "TRUCK" | "RAIL" | "SEA" | "AIR")}
                  className={inputCls}
                >
                  {TRANSPORT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <button
              type="submit"
              disabled={calculating}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2"
            >
              {calculating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {calculating
                ? "Calculating..."
                : passport.carbonFootprintCalculation
                  ? "Recalculate"
                  : "Calculate Footprint"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
