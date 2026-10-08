"use client";

/**
 * components/supplier/supplier-submission-form.tsx
 * -----------------------------------------------------------------------
 * Phase 4 - Step 2: Supplier Onboarding Portal — the public batch
 * submission form rendered at /supplier/submit/[token]. Field names
 * mirror SupplierSubmissionInputSchema exactly (lib/types.ts) so a 400
 * response's `issues.fieldErrors` maps directly onto the fields below —
 * same convention as components/dashboard/create-passport-modal.tsx.
 *
 * Not wrapped in the app's usual admin/dashboard chrome (no header nav,
 * no "Public View" link) — this page is reached by an external supplier
 * who has never seen the rest of the app and shouldn't need to.
 *
 * Certificate document handling follows this app's established
 * "documentUrl + client-computed documentHash, never fetched server-side"
 * convention (see lib/types.ts's CertificationInputSchema comment) — this
 * form additionally offers a local "Compute hash from a file" control
 * that reads a chosen file with the Web Crypto API entirely in the
 * browser and fills in the hex digest; the file itself is never uploaded
 * anywhere by this app, since no file-storage infrastructure exists here
 * (the supplier still hosts the document themselves and pastes its URL).
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  FileCheck2,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

const POLYMER_TYPES = ["PET", "HDPE", "PVC", "LDPE", "PP", "PS", "PLA", "PHA", "PA", "PC", "ABS", "OTHER"];
const RECYCLED_SOURCES = ["POST_CONSUMER", "POST_INDUSTRIAL", "VIRGIN", "BIO_BASED"];
const CERT_SCHEMES = [
  "ISCC_PLUS",
  "REDCERT2",
  "ISO_14021",
  "ISO_14040_44",
  "EN_15343",
  "EN_16785",
  "GRS",
  "RECYCLASS",
  "OTHER",
];

const FIELD_LABELS: Record<string, string> = {
  polymerType: "Polymer Type",
  grade: "Material Grade",
  meltFlowIndex: "Melt Flow Index",
  density: "Density",
  proposedGtin: "Proposed GTIN",
  proposedBatchId: "Proposed Batch ID",
  recycledContentSource: "Recycled Content Source",
  recycledContentPercent: "Recycled Content (%)",
  bioBasedPercent: "Bio-Based Content (%)",
  carbonFootprintKgCO2ePerKg: "Carbon Footprint",
  weightKg: "Batch Weight (kg)",
  certScheme: "Certification Scheme",
  certificateId: "Certificate ID",
  issuingBody: "Issuing Body",
  certValidFrom: "Certificate Valid From",
  certValidUntil: "Certificate Valid Until",
  certDocumentUrl: "Certificate Document URL",
  certDocumentHash: "Certificate Document Hash",
};

const inputCls =
  "w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500";

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string[];
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-slate-400 block mb-1">{label}</span>
      {children}
      {hint && !error && <span className="text-slate-600 text-[10px] block mt-1">{hint}</span>}
      {error && error.length > 0 && <span className="text-red-400 text-[10px] block mt-1">{error[0]}</span>}
    </label>
  );
}

const emptyForm = {
  polymerType: "PP",
  grade: "",
  meltFlowIndex: "",
  density: "",
  proposedGtin: "",
  proposedBatchId: "",
  recycledContentSource: "",
  recycledContentPercent: "0",
  bioBasedPercent: "0",
  carbonFootprintKgCO2ePerKg: "0",
  weightKg: "",
  certScheme: "",
  certificateId: "",
  issuingBody: "",
  certValidFrom: "",
  certValidUntil: "",
  certDocumentUrl: "",
  certDocumentHash: "",
  supplierNotes: "",
};

type LoadState = "loading" | "ready" | "invalid";

interface InviteContext {
  companyName: string;
  contactName: string;
  country: string;
}

/** Reads a local file and computes its SHA-256 hex digest entirely in the browser — the file is never sent anywhere. */
async function hashFileClientSide(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function SupplierSubmissionForm({ token }: { token: string }) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [invite, setInvite] = useState<InviteContext | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [hashingFile, setHashingFile] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/supplier/invite/${encodeURIComponent(token)}`, { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.success) {
          setLoadState("invalid");
          return;
        }
        setInvite(json.data as InviteContext);
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const recycledMetaHint = Number(form.recycledContentPercent) > 0;
  const errorEntries = useMemo(() => Object.entries(fieldErrors), [fieldErrors]);

  const update =
    (key: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHashingFile(true);
    try {
      const hash = await hashFileClientSide(file);
      setForm((prev) => ({ ...prev, certDocumentHash: hash }));
    } catch {
      setSubmitError("Couldn't compute a hash for that file in this browser — paste the SHA-256 hash manually instead.");
    } finally {
      setHashingFile(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setSubmitError(null);

    const payload = {
      polymerType: form.polymerType,
      grade: form.grade,
      meltFlowIndex: form.meltFlowIndex ? Number(form.meltFlowIndex) : undefined,
      density: form.density ? Number(form.density) : undefined,
      proposedGtin: form.proposedGtin || undefined,
      proposedBatchId: form.proposedBatchId || undefined,
      recycledContentSource: form.recycledContentSource || undefined,
      recycledContentPercent: Number(form.recycledContentPercent),
      bioBasedPercent: Number(form.bioBasedPercent),
      carbonFootprintKgCO2ePerKg: Number(form.carbonFootprintKgCO2ePerKg),
      weightKg: form.weightKg ? Number(form.weightKg) : undefined,
      certScheme: form.certScheme || undefined,
      certificateId: form.certificateId || undefined,
      issuingBody: form.issuingBody || undefined,
      certValidFrom: form.certValidFrom || undefined,
      certValidUntil: form.certValidUntil || undefined,
      certDocumentUrl: form.certDocumentUrl || undefined,
      certDocumentHash: form.certDocumentHash || undefined,
      supplierNotes: form.supplierNotes || undefined,
    };

    try {
      const res = await fetch(`/api/supplier/invite/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json.issues?.fieldErrors) {
          setFieldErrors(json.issues.fieldErrors);
        }
        throw new Error(json.error || `Request failed with status ${res.status}`);
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit batch proposal");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadState === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (loadState === "invalid") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-red-500/5 border border-red-500/20 rounded-2xl p-6 text-center">
          <XCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <h1 className="text-base font-bold text-white mb-1">Link not valid</h1>
          <p className="text-xs text-slate-400 font-mono">
            This supplier submission link is invalid, has been revoked, or has expired. Contact the DPP-Polymer
            administrator who sent it to you for a new link.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
          <h1 className="text-base font-bold text-white mb-1">Submission received</h1>
          <p className="text-xs text-slate-400 font-mono">
            Thank you. Your proposed batch has been queued for review by the DPP-Polymer compliance team. You&apos;ll
            be contacted at the email on file once it&apos;s been approved or if more information is needed.
          </p>
          <button
            onClick={() => {
              setForm(emptyForm);
              setSubmitted(false);
            }}
            className="mt-4 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-all"
          >
            Submit another batch
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-sans overflow-x-hidden">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 pb-6 mb-6 border-b border-slate-800">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-wide">Supplier Batch Submission</h1>
            <p className="text-xs text-slate-400">DPP-Polymer — Supplier Onboarding Portal</p>
          </div>
        </div>

        {invite && (
          <div className="flex items-center gap-2.5 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 mb-6 text-xs">
            <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-slate-300">
              Submitting as <span className="font-semibold text-white">{invite.companyName}</span> ({invite.country})
              — {invite.contactName}
            </span>
          </div>
        )}

        {errorEntries.length > 0 && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono">
            <div className="flex items-center gap-2 text-red-300 font-bold mb-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              {errorEntries.length} field{errorEntries.length > 1 ? "s" : ""} need attention
            </div>
            <ul className="space-y-1 text-red-300/90 pl-1">
              {errorEntries.map(([key, messages]) => (
                <li key={key}>
                  <span className="font-bold">{FIELD_LABELS[key] ?? key}:</span> {messages[0]}
                </li>
              ))}
            </ul>
          </div>
        )}

        {submitError && errorEntries.length === 0 && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-300">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 font-mono text-xs">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <p className="text-slate-300 font-bold mb-3">Material &amp; Batch</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Polymer Type">
                <select value={form.polymerType} onChange={update("polymerType")} className={inputCls}>
                  {POLYMER_TYPES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Material Grade" error={fieldErrors.grade}>
                <input
                  required
                  value={form.grade}
                  onChange={update("grade")}
                  className={inputCls}
                  placeholder="e.g. Injection Molding Grade IM-450"
                />
              </Field>
              <Field label="Melt Flow Index (g/10min)" error={fieldErrors.meltFlowIndex} hint="Optional — if known">
                <input type="number" step="0.01" min="0" value={form.meltFlowIndex} onChange={update("meltFlowIndex")} className={inputCls} />
              </Field>
              <Field label="Density (g/cm³)" error={fieldErrors.density} hint="Optional — if known">
                <input type="number" step="0.001" min="0" value={form.density} onChange={update("density")} className={inputCls} />
              </Field>
              <Field label="Batch Weight (kg)" error={fieldErrors.weightKg} hint="Optional — total weight of this batch">
                <input type="number" step="0.001" min="0" value={form.weightKg} onChange={update("weightKg")} className={inputCls} />
              </Field>
              <Field label="Proposed Batch ID" error={fieldErrors.proposedBatchId} hint="Your own reference — optional">
                <input value={form.proposedBatchId} onChange={update("proposedBatchId")} className={inputCls} placeholder="e.g. YOURCO-2026-014" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Proposed GTIN" error={fieldErrors.proposedGtin} hint="14-digit GS1 GTIN if you hold one — optional">
                  <input value={form.proposedGtin} onChange={update("proposedGtin")} className={inputCls} placeholder="04012345678901" />
                </Field>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <p className="text-slate-300 font-bold mb-3">Sustainability &amp; Carbon</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Recycled Content Source"
                error={fieldErrors.recycledContentSource}
                hint={recycledMetaHint ? "Required once Recycled Content % is above 0" : undefined}
              >
                <select value={form.recycledContentSource} onChange={update("recycledContentSource")} className={inputCls}>
                  <option value="">— none —</option>
                  {RECYCLED_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Recycled Content (%)" error={fieldErrors.recycledContentPercent}>
                <input type="number" step="0.01" min="0" max="100" value={form.recycledContentPercent} onChange={update("recycledContentPercent")} className={inputCls} />
              </Field>
              <Field label="Bio-Based Content (%)" error={fieldErrors.bioBasedPercent}>
                <input type="number" step="0.01" min="0" max="100" value={form.bioBasedPercent} onChange={update("bioBasedPercent")} className={inputCls} />
              </Field>
              <Field label="Carbon Footprint (kg CO2e/kg)" error={fieldErrors.carbonFootprintKgCO2ePerKg}>
                <input type="number" step="0.001" min="0" value={form.carbonFootprintKgCO2ePerKg} onChange={update("carbonFootprintKgCO2ePerKg")} className={inputCls} />
              </Field>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <p className="text-slate-300 font-bold mb-1">Compliance Certificate</p>
            <p className="text-slate-500 text-[10px] mb-3">
              Optional at submission, but required before a reviewer can approve this batch. Provide all fields
              together if you provide any.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Scheme" error={fieldErrors.certScheme}>
                <select value={form.certScheme} onChange={update("certScheme")} className={inputCls}>
                  <option value="">— none —</option>
                  {CERT_SCHEMES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Certificate ID" error={fieldErrors.certificateId}>
                <input value={form.certificateId} onChange={update("certificateId")} className={inputCls} />
              </Field>
              <Field label="Issuing Body" error={fieldErrors.issuingBody}>
                <input value={form.issuingBody} onChange={update("issuingBody")} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Valid From" error={fieldErrors.certValidFrom}>
                  <input type="date" value={form.certValidFrom} onChange={update("certValidFrom")} className={inputCls} />
                </Field>
                <Field label="Valid Until" error={fieldErrors.certValidUntil}>
                  <input type="date" value={form.certValidUntil} onChange={update("certValidUntil")} className={inputCls} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Certificate Document URL" error={fieldErrors.certDocumentUrl} hint="A link where the reviewer can view the certificate">
                  <input type="url" value={form.certDocumentUrl} onChange={update("certDocumentUrl")} className={inputCls} placeholder="https://..." />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field
                  label="Certificate Document Hash (SHA-256)"
                  error={fieldErrors.certDocumentHash}
                  hint="Proves the document at the URL above hasn't been swapped later — computed locally in your browser, the file itself is never uploaded"
                >
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={form.certDocumentHash}
                      onChange={update("certDocumentHash")}
                      className={`${inputCls} flex-1`}
                      placeholder="auto-filled after choosing a file, or paste one"
                    />
                    <label className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-xl cursor-pointer whitespace-nowrap">
                      {hashingFile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                      {hashingFile ? "Hashing..." : "Compute from file"}
                      <input type="file" onChange={handleFilePicked} className="hidden" />
                    </label>
                  </div>
                  {form.certDocumentHash && !hashingFile && (
                    <span className="text-emerald-400 text-[10px] flex items-center gap-1 mt-1">
                      <FileCheck2 className="w-3 h-3" /> Hash ready
                    </span>
                  )}
                </Field>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <Field label="Notes for the reviewer" hint="Anything else the compliance team should know — optional">
              <textarea
                value={form.supplierNotes}
                onChange={update("supplierNotes")}
                rows={3}
                className={inputCls}
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? "Submitting..." : "Submit Batch Proposal"}
          </button>
        </form>
      </div>
    </div>
  );
}
