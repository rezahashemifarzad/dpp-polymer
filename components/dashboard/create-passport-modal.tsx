"use client";

/**
 * components/dashboard/create-passport-modal.tsx
 * -----------------------------------------------------------------------
 * Form that POSTs a new polymer passport claim to /api/passports. Field
 * names mirror PolymerPassportInputSchema exactly (lib/types.ts) so a 400
 * response's `issues.fieldErrors` maps directly onto the fields below.
 */

import React, { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { usePassports, PassportValidationError, type CreatePassportInput } from "@/lib/hooks/use-passports";

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

interface CreatePassportModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
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
  children,
}: {
  label: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-slate-400 block mb-1">{label}</span>
      {children}
      {error && error.length > 0 && <span className="text-red-400 text-[10px] block mt-1">{error[0]}</span>}
    </label>
  );
}

export function CreatePassportModal({ open, onClose, onCreated }: CreatePassportModalProps) {
  const { push } = useToast();
  const { createPassport } = usePassports();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  if (!open) return null;

  const update =
    (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
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
      const created = await createPassport(payload);
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
        push({
          variant: "error",
          title: "Validation failed",
          description: "Check the highlighted fields and try again.",
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl p-6 relative shadow-2xl my-8">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-800"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-bold text-white mb-1">Issue New Polymer Passport</h3>
        <p className="text-xs text-slate-400 mb-6 font-mono">
          Persists to Neon via POST /api/passports. New records start as PENDING_VERIFICATION.
        </p>

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
                value={form.grade}
                onChange={update("grade")}
                className={inputCls}
                placeholder="Injection Molding Grade IM-450"
              />
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
            <Field label="GTIN (14 digits)" error={fieldErrors.gtin}>
              <input
                required
                pattern="\d{14}"
                value={form.gtin}
                onChange={update("gtin")}
                className={inputCls}
                placeholder="04012345678905"
              />
            </Field>
            <Field label="Batch ID" error={fieldErrors.batchId}>
              <input
                required
                value={form.batchId}
                onChange={update("batchId")}
                className={inputCls}
                placeholder="BATCH-2026-EU-014"
              />
            </Field>
            <Field label="Manufacturer ID (UUID)" error={fieldErrors.manufacturerId}>
              <input
                required
                value={form.manufacturerId}
                onChange={update("manufacturerId")}
                className={inputCls}
                placeholder="uuid of an existing Manufacturer row"
              />
            </Field>
            <Field label="Recycled Content Source" error={fieldErrors.recycledContentSource}>
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
            <Field label="Recycled Content Cert. Scheme" error={fieldErrors.recycledContentCertScheme}>
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
  );
}
