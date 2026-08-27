"use client";

/**
 * components/dashboard/reach-ppwr/reach-ppwr-panel.tsx
 * -----------------------------------------------------------------------
 * Admin panel for declaring/updating a passport's REACH Article 33 SVHC
 * status and PPWR packaging compliance — rendered inside
 * components/dashboard/batch-details-modal.tsx, same slot convention as
 * the existing Certifications / Genealogy / Chain-of-Custody panels there.
 *
 * Two independent forms (SVHC and PPWR), each posting through its own
 * Server Action (lib/actions/declare-svhc-status.ts,
 * lib/actions/declare-ppwr-compliance.ts) via the declareSvhcStatus /
 * declarePpwrCompliance methods on usePassports() — same dual-path
 * pattern (Server Action for in-app, RBAC'd REST route for external
 * callers) used everywhere else in this app. Kept as two forms, not one,
 * because the two declarations are reassessed independently and have
 * separate AuditLog actions (REACH_SVHC_DECLARED / PPWR_COMPLIANCE_DECLARED)
 * — see lib/services/declare-svhc-status.ts's own file banner.
 *
 * No Auditor VERIFIED/REJECTED workflow here (unlike Certifications) — a
 * REACH Article 33 declaration is legally the manufacturer's own binding
 * statement, not a third-party certificate an Auditor grants. Submitting
 * this form publishes immediately, exactly like the public scan page's
 * own "self-declared by the manufacturer" labeling already makes clear.
 */

import React, { useState } from "react";
import { FlaskConical, PackageCheck, Plus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import type { ApiPassport, SvhcStatusValue } from "@/lib/hooks/use-passports";
import { SvhcStatusBadge } from "./svhc-status-badge";

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

const SVHC_STATUS_OPTIONS: Array<{ value: SvhcStatusValue; label: string }> = [
  { value: "NOT_ASSESSED", label: "Not Assessed" },
  { value: "NONE_DECLARED", label: "None Declared (confirmed clean)" },
  { value: "SVHC_PRESENT", label: "SVHC Present" },
];

const PPWR_GRADE_OPTIONS = ["GRADE_A", "GRADE_B", "GRADE_C", "GRADE_D", "GRADE_E", "NOT_RECYCLABLE"];

interface SubstanceFormRow {
  casNumber: string;
  substanceName: string;
  concentrationPercent: string;
  candidateListDate: string;
  safeUseInstructions: string;
}

function emptyRow(): SubstanceFormRow {
  return { casNumber: "", substanceName: "", concentrationPercent: "", candidateListDate: "", safeUseInstructions: "" };
}

interface ReachPpwrPanelProps {
  passport: ApiPassport;
  onDeclareSvhc: (
    batchId: string,
    input: {
      status: SvhcStatusValue;
      substances?: Array<{
        casNumber: string;
        substanceName: string;
        concentrationPercent: number;
        candidateListDate: string;
        safeUseInstructions?: string;
      }>;
    }
  ) => Promise<unknown>;
  onDeclarePpwr: (
    batchId: string,
    input: { recyclabilityGrade?: string; pfasCompliant?: boolean; pfasConcentrationPpb?: number }
  ) => Promise<unknown>;
}

export function ReachPpwrPanel({ passport, onDeclareSvhc, onDeclarePpwr }: ReachPpwrPanelProps) {
  const { push } = useToast();

  // --- SVHC form state -----------------------------------------------------
  const [svhcStatus, setSvhcStatus] = useState<SvhcStatusValue>(passport.svhcStatus);
  const [rows, setRows] = useState<SubstanceFormRow[]>(
    passport.substanceDeclarations.length > 0
      ? passport.substanceDeclarations.map((s) => ({
          casNumber: s.casNumber,
          substanceName: s.substanceName,
          concentrationPercent: s.concentrationPercent,
          candidateListDate: s.candidateListDate.slice(0, 10),
          safeUseInstructions: s.safeUseInstructions ?? "",
        }))
      : [emptyRow()]
  );
  const [savingSvhc, setSavingSvhc] = useState(false);

  // --- PPWR form state -------------------------------------------------------
  const [grade, setGrade] = useState(passport.ppwrRecyclabilityGrade ?? "");
  const [pfasCompliant, setPfasCompliant] = useState<"" | "true" | "false">(
    passport.ppwrPfasCompliant === null ? "" : passport.ppwrPfasCompliant ? "true" : "false"
  );
  const [pfasPpb, setPfasPpb] = useState(passport.ppwrPfasConcentrationPpb ?? "");
  const [savingPpwr, setSavingPpwr] = useState(false);

  const updateRow = (i: number, patch: Partial<SubstanceFormRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const handleSvhcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSvhc(true);
    try {
      const substances =
        svhcStatus === "SVHC_PRESENT"
          ? rows
              .filter((r) => r.casNumber.trim() && r.substanceName.trim())
              .map((r) => ({
                casNumber: r.casNumber.trim(),
                substanceName: r.substanceName.trim(),
                concentrationPercent: Number(r.concentrationPercent),
                candidateListDate: r.candidateListDate,
                safeUseInstructions: r.safeUseInstructions.trim() || undefined,
              }))
          : [];
      await onDeclareSvhc(passport.batchId, { status: svhcStatus, substances });
      push({
        variant: "success",
        title: "SVHC status declared",
        description: `${passport.batchId} — ${svhcStatus.replace("_", " ").toLowerCase()}.`,
      });
    } catch (err) {
      push({
        variant: "error",
        title: "Could not declare SVHC status",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSavingSvhc(false);
    }
  };

  const handlePpwrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPpwr(true);
    try {
      await onDeclarePpwr(passport.batchId, {
        recyclabilityGrade: grade || undefined,
        pfasCompliant: pfasCompliant === "" ? undefined : pfasCompliant === "true",
        pfasConcentrationPpb: pfasPpb ? Number(pfasPpb) : undefined,
      });
      push({ variant: "success", title: "PPWR compliance updated", description: `${passport.batchId} assessment saved.` });
    } catch (err) {
      push({
        variant: "error",
        title: "Could not update PPWR compliance",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSavingPpwr(false);
    }
  };

  return (
    <>
      {/* REACH Article 33 SVHC panel */}
      <div className="border border-slate-800 rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-slate-100">REACH Article 33 — SVHC Declaration</h4>
          </div>
          <SvhcStatusBadge status={passport.svhcStatus} />
        </div>
        <p className="text-[11px] text-slate-500 font-mono mb-3">
          Self-declared by the manufacturer under REACH Article 33 — not an Auditor-verified claim.
          {passport.svhcStatusDeclaredAt &&
            ` Last declared ${new Date(passport.svhcStatusDeclaredAt).toLocaleDateString()}.`}
        </p>

        <form onSubmit={handleSvhcSubmit} className="space-y-3 font-mono text-xs">
          <Field label="Status">
            <select
              value={svhcStatus}
              onChange={(e) => setSvhcStatus(e.target.value as SvhcStatusValue)}
              className={inputCls}
            >
              {SVHC_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          {svhcStatus === "SVHC_PRESENT" && (
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="CAS Number">
                      <input
                        required
                        value={row.casNumber}
                        onChange={(e) => updateRow(i, { casNumber: e.target.value })}
                        placeholder="117-81-7"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Substance Name">
                      <input
                        required
                        value={row.substanceName}
                        onChange={(e) => updateRow(i, { substanceName: e.target.value })}
                        placeholder="DEHP"
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Concentration (% w/w)">
                      <input
                        required
                        type="number"
                        step="0.0001"
                        min="0"
                        max="100"
                        value={row.concentrationPercent}
                        onChange={(e) => updateRow(i, { concentrationPercent: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Candidate List Date">
                      <input
                        required
                        type="date"
                        value={row.candidateListDate}
                        onChange={(e) => updateRow(i, { candidateListDate: e.target.value })}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <Field label="Safe Use Instructions (optional)">
                    <input
                      value={row.safeUseInstructions}
                      onChange={(e) => updateRow(i, { safeUseInstructions: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="flex items-center gap-1 text-rose-400 hover:text-rose-300 text-[11px]"
                    >
                      <Trash2 className="w-3 h-3" /> Remove substance
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-[11px]"
              >
                <Plus className="w-3 h-3" /> Add another substance
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={savingSvhc}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition text-[11px]"
          >
            {savingSvhc && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save SVHC Declaration
          </button>
        </form>
      </div>

      {/* PPWR panel */}
      <div className="border border-slate-800 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <PackageCheck className="w-4 h-4 text-blue-400" />
          <h4 className="text-sm font-semibold text-slate-100">PPWR Packaging Compliance</h4>
        </div>
        <p className="text-[11px] text-slate-500 font-mono mb-3">
          Optional — only relevant for batches destined for packaging use.
          {passport.ppwrAssessedAt && ` Last assessed ${new Date(passport.ppwrAssessedAt).toLocaleDateString()}.`}
        </p>
        <form onSubmit={handlePpwrSubmit} className="space-y-3 font-mono text-xs">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Design-for-Recycling Grade">
              <select value={grade} onChange={(e) => setGrade(e.target.value)} className={inputCls}>
                <option value="">— not assessed —</option>
                {PPWR_GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g.replace("GRADE_", "Grade ").replace("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="PFAS Threshold">
              <select
                value={pfasCompliant}
                onChange={(e) => setPfasCompliant(e.target.value as "" | "true" | "false")}
                className={inputCls}
              >
                <option value="">— not assessed —</option>
                <option value="true">Compliant (below threshold)</option>
                <option value="false">Non-compliant (exceeds threshold)</option>
              </select>
            </Field>
          </div>
          <Field label="Measured PFAS Concentration (ppb, optional)">
            <input
              type="number"
              step="0.001"
              min="0"
              value={pfasPpb}
              onChange={(e) => setPfasPpb(e.target.value)}
              className={inputCls}
            />
          </Field>
          <button
            type="submit"
            disabled={savingPpwr}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition text-[11px]"
          >
            {savingPpwr && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save PPWR Assessment
          </button>
        </form>
      </div>
    </>
  );
}
