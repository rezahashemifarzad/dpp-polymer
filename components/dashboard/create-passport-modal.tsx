"use client";

/**
 * components/dashboard/create-passport-modal.tsx
 * -----------------------------------------------------------------------
 * Form that POSTs a new polymer passport claim to /api/passports. Field
 * names mirror PolymerPassportInputSchema exactly (lib/types.ts) so a 400
 * response's `issues.fieldErrors` maps directly onto the fields below.
 *
 * Three things that previously caused silent-looking 400s are addressed
 * here directly (see the follow-up after the initial Step 5 delivery):
 *   1. The GTIN example was itself invalid against the GS1 check-digit
 *      rule — fixed, plus a live validity indicator and a "Generate
 *      valid GTIN" button so nobody has to hand-compute a check digit.
 *   2. recycledContentSource / recycledContentCertScheme become required
 *      the moment recycledContentPercent > 0 (a real cross-field rule in
 *      the schema) — now visually flagged instead of failing silently.
 *   3. manufacturerId must be a real Manufacturer row's UUID — there was
 *      no way to get one. See prisma/seed.ts and the hint below the field.
 *
 * `onCreate` is passed in by the parent (which already holds a
 * usePassports() instance) rather than this component calling
 * usePassports() itself — avoids spinning up a second, redundant
 * GET /api/passports fetch every time the modal mounts.
 *
 * Autocomplete: Grade Name and Manufacturer both draw suggestions from
 * useFormSuggestions() (lib/services/form-suggestions.ts), fetched once
 * per modal open. Grade uses a native <datalist> — a plain free-text
 * field where the typed value IS the submitted value, so the browser's
 * own suggestion UI is the simplest correct tool. Manufacturer uses the
 * dedicated ManufacturerAutocompleteField combobox instead, because that
 * field's submitted value (a Manufacturer row's UUID) isn't what a
 * person actually recognizes — see that component's own file banner.
 */

import React, { useMemo, useState } from "react";
import { X, Loader2, CheckCircle2, XCircle, Wand2, AlertTriangle } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { PassportValidationError, type ApiPassport, type CreatePassportInput } from "@/lib/hooks/use-passports";
import { isValidGtin14, generateValidGtin } from "@/lib/gtin";
import { useFormSuggestions } from "@/lib/hooks/use-form-suggestions";
import { ManufacturerAutocompleteField } from "@/components/dashboard/manufacturer-autocomplete-field";

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
  grade: "Grade Name",
  meltFlowIndex: "Melt Flow Index",
  density: "Density",
  gtin: "GTIN",
  batchId: "Batch ID",
  manufacturerId: "Manufacturer ID",
  recycledContentSource: "Recycled Content Source",
  recycledContentPercent: "Recycled Content (%)",
  recycledContentCertScheme: "Recycled Content Cert. Scheme",
  bioBasedPercent: "Bio-Based Content (%)",
  carbonFootprintKgCO2ePerKg: "Carbon Footprint",
  certifications: "Certification",
};

interface CreatePassportModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onCreate: (input: CreatePassportInput) => Promise<ApiPassport>;
}

const emptyForm = {
  polymerType: "PP",
  grade: "",
  meltFlowIndex: "",
  density: "",
  gtin: "",
  batchId: "",
  manufacturerId: "",
  recycledContentSource: "",
  recycledContentPercent: "0",
  recycledContentCertScheme: "",
  bioBasedPercent: "0",
  carbonFootprintKgCO2ePerKg: "0",
  certScheme: "ISCC_PLUS",
  certificateId: "",
  issuingBody: "",
  validFrom: "",
  validUntil: "",
};

const inputCls =
  "w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500";

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string[];
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-slate-400 block mb-1">
        {label}
        {required && <span className="text-amber-400"> *required</span>}
      </span>
      {children}
      {error && error.length > 0 && <span className="text-red-400 text-[10px] block mt-1">{error[0]}</span>}
    </label>
  );
}

export function CreatePassportModal({ open, onClose, onCreated, onCreate }: CreatePassportModalProps) {
  const { push } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const { suggestions } = useFormSuggestions(open);

  const gtinIsValid = form.gtin.length > 0 && isValidGtin14(form.gtin);
  const gtinShowsInvalid = form.gtin.length === 14 && !gtinIsValid;
  const recycledMetaRequired = Number(form.recycledContentPercent) > 0;

  const errorEntries = useMemo(() => Object.entries(fieldErrors), [fieldErrors]);

  if (!open) return null;

  const update =
    (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const handleGenerateGtin = () => {
    const digitsOnly = form.gtin.replace(/\D/g, "").slice(0, 13);
    setForm((prev) => ({ ...prev, gtin: generateValidGtin(digitsOnly.length === 13 ? digitsOnly : undefined) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFieldErrors({});

    const payload: CreatePassportInput = {
      polymerType: form.polymerType,
      grade: form.grade,
      meltFlowIndex: Number(form.meltFlowIndex),
      density: Number(form.density),
      gtin: form.gtin,
      batchId: form.batchId,
      manufacturerId: form.manufacturerId,
      recycledContentSource: form.recycledContentSource || undefined,
      recycledContentPercent: Number(form.recycledContentPercent),
      recycledContentCertScheme: form.recycledContentCertScheme || undefined,
      bioBasedPercent: Number(form.bioBasedPercent),
      carbonFootprintKgCO2ePerKg: Number(form.carbonFootprintKgCO2ePerKg),
      certifications: [
        {
          scheme: form.certScheme,
          certificateId: form.certificateId,
          issuingBody: form.issuingBody,
          validFrom: form.validFrom,
          validUntil: form.validUntil,
        },
      ],
    };

    try {
      const created = await onCreate(payload);
      push({
        variant: "success",
        title: "Passport issued",
        description: `Batch ${created.batchId} created as PENDING_VERIFICATION.`,
      });
      setForm(emptyForm);
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof PassportValidationError) {
        setFieldErrors(err.fieldErrors);
        const failing = Object.keys(err.fieldErrors)
          .map((key) => FIELD_LABELS[key] ?? key)
          .join(", ");
        push({
          variant: "error",
          title: "Validation failed",
          description: failing ? `Check: ${failing}` : "Check the highlighted fields and try again.",
        });
      } else {
        const message = err instanceof Error ? err.message : "Failed to create passport";
        push({ variant: "error", title: "Could not create passport", description: message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // Bug fix — "modal content often exceeds the viewport height; the top
    // nav/back button isn't reachable without manual scrolling." Same fix
    // as batch-details-modal.tsx's own comment on this pattern: the
    // backdrop no longer scrolls; the card is a flex column capped at 90%
    // viewport height with a `shrink-0` header (title + close) that never
    // scrolls, and a separate `overflow-y-auto` body for the (long) form.
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="shrink-0 relative px-6 pt-6 pb-4 border-b border-slate-800">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-800"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <h3 className="text-lg font-bold text-white mb-1">Issue New Polymer Passport</h3>
          <p className="text-xs text-slate-400 font-mono">
            Persists to Neon via POST /api/passports. New records start as PENDING_VERIFICATION.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
        {errorEntries.length > 0 && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono">
            <div className="flex items-center gap-2 text-red-300 font-bold mb-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              {errorEntries.length} field{errorEntries.length > 1 ? "s" : ""} rejected by the server
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

        <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Polymer Type">
              <select value={form.polymerType} onChange={update("polymerType")} className={inputCls}>
                {POLYMER_TYPES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Grade Name" error={fieldErrors.grade}>
              <input
                required
                list="grade-suggestions"
                value={form.grade}
                onChange={update("grade")}
                className={inputCls}
                placeholder="Injection Molding Grade IM-450"
                autoComplete="off"
              />
              <datalist id="grade-suggestions">
                {suggestions.grades.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </Field>
            <Field label="Melt Flow Index (g/10min)" error={fieldErrors.meltFlowIndex}>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.meltFlowIndex}
                onChange={update("meltFlowIndex")}
                className={inputCls}
              />
            </Field>
            <Field label="Density (g/cm³)" error={fieldErrors.density}>
              <input
                required
                type="number"
                step="0.001"
                min="0"
                value={form.density}
                onChange={update("density")}
                className={inputCls}
              />
            </Field>

            <div className="col-span-2">
              <Field label="GTIN (14 digits, GS1 check-digit validated)" error={fieldErrors.gtin}>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      required
                      pattern="\d{14}"
                      value={form.gtin}
                      onChange={update("gtin")}
                      className={`${inputCls} pr-8`}
                      placeholder="04012345678901"
                    />
                    {form.gtin.length === 14 && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                        {gtinIsValid ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateGtin}
                    title="Generate a check-digit-valid GTIN from the digits typed so far (or a random one)"
                    className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> Generate valid GTIN
                  </button>
                </div>
                {gtinShowsInvalid && (
                  <span className="text-amber-400 text-[10px] block mt-1">
                    14 digits entered, but this fails the GS1 mod-10 check digit — click &quot;Generate valid GTIN&quot; for a working example.
                  </span>
                )}
              </Field>
            </div>

            <Field label="Batch ID" error={fieldErrors.batchId}>
              <input
                required
                value={form.batchId}
                onChange={update("batchId")}
                className={inputCls}
                placeholder="BATCH-2026-EU-014"
              />
            </Field>
            <Field label="Manufacturer" error={fieldErrors.manufacturerId}>
              <ManufacturerAutocompleteField
                required
                value={form.manufacturerId}
                onChange={(v) => setForm((prev) => ({ ...prev, manufacturerId: v }))}
                suggestions={suggestions.manufacturers}
                className={inputCls}
                placeholder="Search by name, or paste a Manufacturer UUID"
              />
            </Field>
            <div className="col-span-2 -mt-2">
              <p className="text-[10px] text-slate-500">
                Start typing a manufacturer&apos;s name to pick from existing records. No manufacturer yet? Run{" "}
                <code className="text-slate-400">npx prisma db seed</code> (adds prisma/seed.ts) to create a demo
                one.
              </p>
            </div>

            <Field
              label="Recycled Content Source"
              error={fieldErrors.recycledContentSource}
              required={recycledMetaRequired}
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
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.recycledContentPercent}
                onChange={update("recycledContentPercent")}
                className={inputCls}
              />
            </Field>
            <Field
              label="Recycled Content Cert. Scheme"
              error={fieldErrors.recycledContentCertScheme}
              required={recycledMetaRequired}
            >
              <select
                value={form.recycledContentCertScheme}
                onChange={update("recycledContentCertScheme")}
                className={inputCls}
              >
                <option value="">— none —</option>
                {CERT_SCHEMES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Bio-Based Content (%)" error={fieldErrors.bioBasedPercent}>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.bioBasedPercent}
                onChange={update("bioBasedPercent")}
                className={inputCls}
              />
            </Field>
            <Field label="Carbon Footprint (kg CO2e/kg)" error={fieldErrors.carbonFootprintKgCO2ePerKg}>
              <input
                type="number"
                step="0.001"
                min="0"
                value={form.carbonFootprintKgCO2ePerKg}
                onChange={update("carbonFootprintKgCO2ePerKg")}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <p className="text-slate-300 font-bold mb-2">Certification (at least one required)</p>
            {fieldErrors.certifications && (
              <p className="text-red-400 text-[10px] mb-2">{fieldErrors.certifications[0]}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Scheme">
                <select value={form.certScheme} onChange={update("certScheme")} className={inputCls}>
                  {CERT_SCHEMES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Certificate ID">
                <input required value={form.certificateId} onChange={update("certificateId")} className={inputCls} />
              </Field>
              <Field label="Issuing Body">
                <input required value={form.issuingBody} onChange={update("issuingBody")} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Valid From">
                  <input required type="date" value={form.validFrom} onChange={update("validFrom")} className={inputCls} />
                </Field>
                <Field label="Valid Until">
                  <input
                    required
                    type="date"
                    value={form.validUntil}
                    onChange={update("validUntil")}
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {submitting ? "Issuing..." : "Issue Passport"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
