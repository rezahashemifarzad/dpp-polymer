'use client';
import { useState, useMemo } from "react";
import {
  FlaskConical, Recycle, Leaf, ShieldCheck, FileCheck2, Factory, Hash,
  Layers, MapPin, CheckCircle2, Clock, ArrowLeft, Smartphone,
  LayoutDashboard, Plus, Trash2, BadgeCheck, Gauge, ChevronDown, Link2,
} from "lucide-react";

/* ============================================================================
 * DESIGN TOKENS (per frontend-design brief)
 * ----------------------------------------------------------------------------
 * Subject: industrial polymer traceability — the visual language borrows from
 * spec sheets, certification seals, and instrumentation readouts rather than
 * generic SaaS/dashboard chrome.
 *
 * Color
 *   base        slate-50   — cool, clinical, not the default warm cream
 *   surface     white       bordered in slate-200
 *   ink         slate-900 / slate-500
 *   circularity teal-700 / teal-50   — the recycled-content / verified signal
 *   seal        amber-600 / amber-50 — certification "brass stamp" accent
 *   pending     amber-500
 *   revoked     rose-600
 *   data chip   slate-100 bg / slate-700 text (mono)
 *
 * Type
 *   display  Space Grotesk  — geometric, technical, used sparingly for
 *            section heads and the hero score
 *   body     IBM Plex Sans  — designed for engineering/technical products
 *   data     IBM Plex Mono  — batch IDs, hashes, MFI/density readouts
 *
 * Signature element: the "Hash Fingerprint" strip. The record's SHA-256
 * (see hashRecord() in types.ts) is rendered as a deterministic barcode of
 * bars. It appears live while editing (dashboard) and as the trust seal on
 * the public scan view — the same visual device doing both an editorial and
 * a functional job, which is the one place this UI spends its boldness.
 * ==========================================================================*/

const FontImport = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
    .f-display { font-family: 'Space Grotesk', sans-serif; }
    .f-body { font-family: 'IBM Plex Sans', system-ui, sans-serif; }
    .f-mono { font-family: 'IBM Plex Mono', monospace; }
  `}</style>
);

/* ---------------------------------------------------------------------------
 * Illustrative hash — NOT cryptographic. The real SHA-256 is computed
 * server-side via hashRecord() in types.ts at issuance. This purely gives
 * the form a live-updating fingerprint so the founder can see the concept
 * before the API is wired up.
 * ------------------------------------------------------------------------*/
function illustrativeHash(input) {
  if (!input) return "0".repeat(64);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const raw = (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
  return raw.repeat(4).slice(0, 64);
}
function fingerprintBars(hash, count = 40) {
  const bars = [];
  for (let i = 0; i < count; i++) {
    const byte = parseInt(hash.substr((i * 2) % hash.length, 2), 16) || 0;
    bars.push(12 + (byte / 255) * 88);
  }
  return bars;
}

/* Mirrors buildGs1VerificationUrl() from qr.ts for the live dashboard
 * preview — /01/{GTIN-14}/21/{batchId}?v={token}. The real URL is built
 * server-side at issuance; this is illustrative only. */
function padGtin(raw) {
  return (raw || "").replace(/\D/g, "").padStart(14, "0").slice(-14);
}
function previewGs1Url(gtin, batchId, hash) {
  const token = hash.slice(0, 16);
  return `https://dpp.yourdomain.com/01/${padGtin(gtin)}/21/${encodeURIComponent(batchId || "—")}?v=${token}`;
}

function FingerprintStrip({ hash, tone = "teal" }) {
  const bars = useMemo(() => fingerprintBars(hash), [hash]);
  const barColor = tone === "teal" ? "bg-teal-600" : "bg-amber-600";
  return (
    <div className="flex items-end gap-[2px] h-10 w-full">
      {bars.map((h, i) => (
        <div
          key={i}
          className={`flex-1 ${barColor} rounded-sm`}
          style={{ height: `${h}%`, opacity: 0.4 + (h / 100) * 0.6 }}
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Shared status stamp
 * ------------------------------------------------------------------------*/
const STATUS_CONFIG = {
  DRAFT: { label: "Draft", icon: Clock, cls: "bg-slate-100 text-slate-600 border-slate-300" },
  PENDING_VERIFICATION: { label: "Pending verification", icon: Clock, cls: "bg-amber-50 text-amber-700 border-amber-300" },
  ISSUED: { label: "Issued & verified", icon: CheckCircle2, cls: "bg-teal-50 text-teal-700 border-teal-300" },
};

function StatusStamp({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium f-body ${cfg.cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * Form primitives (spec-sheet style: label above field, mono for numbers)
 * ------------------------------------------------------------------------*/
function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500 f-body">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400 f-body">{hint}</span>}
    </label>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 f-mono focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600";
const selectCls = inputCls + " f-body appearance-none";

function SectionHead({ index, title, icon: Icon, subtitle }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-teal-700 text-white">
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="f-mono text-xs text-teal-700">§{index}</span>
          <h3 className="f-display text-base font-semibold text-slate-900">{title}</h3>
        </div>
        {subtitle && <p className="text-xs text-slate-500 f-body mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ============================================================================
 * B2B MANUFACTURER DASHBOARD — passport creation / issuance form
 * ==========================================================================*/
function ManufacturerDashboard() {
  const [form, setForm] = useState({
    polymerType: "rPET",
    grade: "Injection Molding Grade IM-450",
    gtin: "04006381333931",
    meltFlowIndex: "24.0",
    mfiTestStandard: "ISO 1133 (2.16kg / 230°C)",
    density: "1.370",
    densityTestStandard: "ISO 1183",
    colorAdditives: "",
    recycledContentSource: "POST_CONSUMER",
    recycledContentPercent: "65",
    bioBasedPercent: "0",
    carbonFootprintKgCO2ePerKg: "1.42",
    lcaMethodology: "PEF",
    lcaThirdPartyVerified: true,
    lcaVerifierName: "TÜV Rheinland",
    batchId: "BATCH-2026-08-0142",
    manufacturerId: "Rhein Polymer Recycling GmbH",
    productionDate: "2026-08-04",
  });

  const [certs, setCerts] = useState([
    { id: 1, scheme: "ISCC_PLUS", certificateId: "ISCC-DE-100.4231", issuingBody: "ISCC System GmbH", validUntil: "2027-03-31", documentUrl: "" },
  ]);

  const [status, setStatus] = useState("DRAFT");
  const [issuing, setIssuing] = useState(false);

  const update = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const addCert = () =>
    setCerts((c) => [...c, { id: Date.now(), scheme: "GRS", certificateId: "", issuingBody: "", validUntil: "", documentUrl: "" }]);
  const removeCert = (id) => setCerts((c) => c.filter((x) => x.id !== id));
  const updateCert = (id, key, value) =>
    setCerts((c) => c.map((x) => (x.id === id ? { ...x, [key]: value } : x)));

  const hash = useMemo(
    () => illustrativeHash(JSON.stringify(form) + JSON.stringify(certs)),
    [form, certs]
  );

  const recycled = parseFloat(form.recycledContentPercent) || 0;
  const bio = parseFloat(form.bioBasedPercent) || 0;
  const virgin = Math.max(0, 100 - recycled - bio);

  // Production: POSTs the full payload to /api/passports (route.create.ts).
  // Network calls here are wrapped in try/catch and don't block the local
  // status transition, since this artifact runs standalone for UI review
  // without a live backend attached.
  async function handleSubmitForVerification() {
    // Certifications only collect validUntil in this UI — default validFrom
    // to the batch's productionDate when the auditor hasn't set one
    // explicitly, since a cert is typically already active by the time a
    // batch is produced. Swap this for a per-row validFrom input if a
    // scheme's actual issue date needs to be tracked precisely.
    const certsWithValidFrom = certs.map((c) => ({
      ...c,
      validFrom: c.validFrom || form.productionDate,
    }));
    try {
      await fetch("/api/passports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, recycledContentPercent: recycled, bioBasedPercent: bio, certifications: certsWithValidFrom }),
      });
    } catch {
      /* no backend attached in this preview — status still advances locally */
    }
    setStatus("PENDING_VERIFICATION");
  }

  // Production: PATCHes /api/passports/{batchId}/verify (route.verify.ts) —
  // that endpoint re-verifies integrity server-side and rejects the issue
  // if the stored hash no longer matches, so this button can't force an
  // issue past a failed check even if someone bypasses this UI.
  async function handleApproveIssue() {
    setIssuing(true);
    try {
      await fetch(`/api/passports/${encodeURIComponent(form.batchId)}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditorId: "demo-auditor" }),
      });
    } catch {
      /* no backend attached in this preview */
    } finally {
      setStatus("ISSUED");
      setIssuing(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-teal-700 f-mono text-xs uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5" /> DPP-Polymer · Manufacturer Console
          </div>
          <h1 className="f-display text-2xl font-semibold text-slate-900 mt-1">
            New Passport — {form.batchId || "Untitled batch"}
          </h1>
        </div>
        <StatusStamp status={status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form column */}
        <div className="lg:col-span-2 space-y-6">
          {/* §1 Material Identification */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <SectionHead index={1} title="Material Identification" icon={FlaskConical}
              subtitle="Polymer type, grade and physical properties per test standard" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Polymer type">
                <div className="relative">
                  <select className={selectCls} value={form.polymerType} onChange={update("polymerType")}>
                    {["rPET", "PET", "HDPE", "PP", "LDPE", "PVC", "PS", "PLA", "PHA", "PA", "PC", "ABS"].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </Field>
              <Field label="Grade">
                <input className={inputCls + " f-body"} value={form.grade} onChange={update("grade")} />
              </Field>
              <Field label="GTIN" hint="GS1 trade item number — drives the QR Digital Link">
                <input className={inputCls} value={form.gtin} onChange={update("gtin")} maxLength={14} />
              </Field>
              <Field label="Melt Flow Index (g/10min)">
                <input className={inputCls} value={form.meltFlowIndex} onChange={update("meltFlowIndex")} />
              </Field>
              <Field label="MFI test conditions">
                <input className={inputCls} value={form.mfiTestStandard} onChange={update("mfiTestStandard")} />
              </Field>
              <Field label="Density (g/cm³)">
                <input className={inputCls} value={form.density} onChange={update("density")} />
              </Field>
              <Field label="Density test standard">
                <input className={inputCls} value={form.densityTestStandard} onChange={update("densityTestStandard")} />
              </Field>
              <Field label="Color / additives" hint="Optional — relevant to downstream recyclability">
                <input className={inputCls + " f-body"} placeholder="e.g. natural, UV-stabilized"
                  value={form.colorAdditives} onChange={update("colorAdditives")} />
              </Field>
            </div>
          </div>

          {/* §2 Composition */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <SectionHead index={2} title="Recycled & Bio-based Composition" icon={Recycle}
              subtitle="One dominant recycled source per batch — mass-balance certified" />
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Field label="Recycled content source">
                <div className="relative">
                  <select className={selectCls} value={form.recycledContentSource} onChange={update("recycledContentSource")}>
                    <option value="POST_CONSUMER">Post-Consumer (PCR)</option>
                    <option value="POST_INDUSTRIAL">Post-Industrial (PIR)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </Field>
              <Field label="Recycled content (%)">
                <input className={inputCls} value={form.recycledContentPercent} onChange={update("recycledContentPercent")} />
              </Field>
              <Field label="Bio-based content (%)">
                <input className={inputCls} value={form.bioBasedPercent} onChange={update("bioBasedPercent")} />
              </Field>
              <Field label="Bio-based test standard" hint="e.g. ASTM D6866">
                <input className={inputCls} placeholder="—" value={form.bioBasedTestStandard || ""} onChange={update("bioBasedTestStandard")} />
              </Field>
            </div>
            {/* live composition bar — previews the ring shown on the public view */}
            <div className="flex h-3 w-full overflow-hidden rounded-full border border-slate-200">
              <div className="bg-teal-600" style={{ width: `${recycled}%` }} title={`Recycled ${recycled}%`} />
              <div className="bg-emerald-400" style={{ width: `${bio}%` }} title={`Bio-based ${bio}%`} />
              <div className="bg-slate-200" style={{ width: `${virgin}%` }} title={`Virgin ${virgin}%`} />
            </div>
            <div className="flex gap-4 mt-2 text-[11px] f-body text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-600" /> Recycled {recycled}%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Bio-based {bio}%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" /> Virgin {virgin}%</span>
            </div>
          </div>

          {/* §3 Carbon & LCA */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <SectionHead index={3} title="Carbon Footprint & LCA" icon={Gauge}
              subtitle="Cradle-to-gate scope, PEF methodology (locked for Phase 1)" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="kg CO₂e / kg material">
                <input className={inputCls} value={form.carbonFootprintKgCO2ePerKg} onChange={update("carbonFootprintKgCO2ePerKg")} />
              </Field>
              <Field label="LCA scope">
                <div className="mt-1 flex items-center h-[38px] px-3 rounded-md border border-slate-200 bg-slate-50 text-sm f-mono text-slate-500">
                  cradle-to-gate
                </div>
              </Field>
              <Field label="Methodology">
                <input className={inputCls} value={form.lcaMethodology} onChange={update("lcaMethodology")} />
              </Field>
              <Field label="Third-party verifier">
                <input className={inputCls + " f-body"} value={form.lcaVerifierName} onChange={update("lcaVerifierName")} />
              </Field>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-slate-700 f-body">
              <input type="checkbox" checked={form.lcaThirdPartyVerified} onChange={update("lcaThirdPartyVerified")}
                className="rounded border-slate-300 text-teal-700 focus:ring-teal-600" />
              Third-party verified LCA
            </label>
          </div>

          {/* §4 Certifications */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <SectionHead index={4} title="Certifications" icon={FileCheck2}
              subtitle="Chain-of-custody documentation — one row per active certificate" />
            <div className="space-y-3">
              {certs.map((c) => (
                <div key={c.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3">
                      <span className="text-[11px] text-slate-500 f-body">Scheme</span>
                      <select className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs f-body"
                        value={c.scheme} onChange={(e) => updateCert(c.id, "scheme", e.target.value)}>
                        {["ISCC_PLUS", "REDCERT2", "GRS", "RECYCLASS", "ISO_14021", "ISO_14040_44", "EN_15343", "EN_16785", "OTHER"].map((s) => (
                          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <span className="text-[11px] text-slate-500 f-body">Certificate ID</span>
                      <input className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs f-mono"
                        value={c.certificateId} onChange={(e) => updateCert(c.id, "certificateId", e.target.value)} />
                    </div>
                    <div className="col-span-3">
                      <span className="text-[11px] text-slate-500 f-body">Issuing body</span>
                      <input className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs f-body"
                        value={c.issuingBody} onChange={(e) => updateCert(c.id, "issuingBody", e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <span className="text-[11px] text-slate-500 f-body">Valid until</span>
                      <input type="date" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs f-mono"
                        value={c.validUntil} onChange={(e) => updateCert(c.id, "validUntil", e.target.value)} />
                    </div>
                    <button onClick={() => removeCert(c.id)}
                      className="col-span-1 flex items-center justify-center h-8 rounded-md text-rose-600 hover:bg-rose-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 f-body flex items-center gap-1">
                      <Link2 className="w-3 h-3" /> Certificate document (PDF link)
                    </span>
                    <input
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs f-mono placeholder:text-slate-400"
                      placeholder="https://…/certificate.pdf — or paste an upload link once storage is wired up"
                      value={c.documentUrl} onChange={(e) => updateCert(c.id, "documentUrl", e.target.value)}
                    />
                  </div>
                </div>
              ))}
              <button onClick={addCert}
                className="flex items-center gap-1.5 text-xs f-body text-teal-700 hover:text-teal-800 font-medium">
                <Plus className="w-3.5 h-3.5" /> Add certification
              </button>
            </div>
          </div>

          {/* §5 Batch & Manufacturer */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <SectionHead index={5} title="Batch & Manufacturer" icon={Factory}
              subtitle="Traceability keys — this is what the audit trail chains against" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Batch ID">
                <input className={inputCls} value={form.batchId} onChange={update("batchId")} />
              </Field>
              <Field label="Manufacturer">
                <input className={inputCls + " f-body"} value={form.manufacturerId} onChange={update("manufacturerId")} />
              </Field>
              <Field label="Production date">
                <input type="date" className={inputCls} value={form.productionDate} onChange={update("productionDate")} />
              </Field>
              <Field label="Production site GLN" hint="Optional GS1 location number">
                <input className={inputCls} value={form.productionSiteGln || ""} onChange={update("productionSiteGln")} />
              </Field>
            </div>
          </div>
        </div>

        {/* Sidebar: integrity preview + actions */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 sticky top-6">
            <div className="flex items-center gap-2 mb-3">
              <Hash className="w-4 h-4 text-teal-700" />
              <h3 className="f-display text-sm font-semibold text-slate-900">Integrity Preview</h3>
            </div>
            <p className="text-[11px] text-slate-500 f-body mb-3">
              Live illustrative fingerprint — the signed SHA-256 is generated on issuance.
            </p>
            <FingerprintStrip hash={hash} tone="teal" />
            <div className="mt-3 rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
              <span className="text-[10px] text-slate-400 f-body block">recordHash (preview)</span>
              <span className="text-xs f-mono text-slate-700 break-all">{hash}</span>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-200 space-y-2">
              {status === "DRAFT" && (
                <>
                  <button onClick={handleSubmitForVerification}
                    className="w-full rounded-lg bg-teal-700 text-white text-sm font-medium f-body py-2.5 hover:bg-teal-800">
                    Submit for Verification
                  </button>
                  <button className="w-full rounded-lg border border-slate-300 text-slate-700 text-sm font-medium f-body py-2.5 hover:bg-slate-50">
                    Save as Draft
                  </button>
                </>
              )}

              {status === "PENDING_VERIFICATION" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-center gap-1.5 text-amber-700 text-xs f-body font-medium mb-2">
                    <Clock className="w-3.5 h-3.5" /> Awaiting auditor sign-off
                  </div>
                  <button onClick={handleApproveIssue} disabled={issuing}
                    className="w-full rounded-lg bg-teal-700 text-white text-sm font-medium f-body py-2.5 hover:bg-teal-800 disabled:opacity-60">
                    {issuing ? "Issuing…" : "Approve & Issue"}
                  </button>
                  <p className="text-[10px] text-amber-700/80 f-body mt-2">
                    Auditor/Certifier role — server re-verifies data integrity before signing.
                  </p>
                </div>
              )}

              {status === "ISSUED" && (
                <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
                  <span className="text-xs f-body text-teal-700 font-medium">Issued & signed — QR code is now live</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * PUBLIC VERIFICATION VIEW — mobile, shown on QR scan
 * ==========================================================================*/
function DonutRing({ recycled, bio, size = 176, stroke = 16 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const virgin = Math.max(0, 100 - recycled - bio);
  const segs = [
    { pct: recycled, cls: "text-teal-600" },
    { pct: bio, cls: "text-emerald-400" },
    { pct: virgin, cls: "text-slate-200" },
  ];
  let offset = 0;
  return (
    <svg width={size} height={size} className="-rotate-90">
      {segs.map((s, i) => {
        const len = (s.pct / 100) * c;
        const el = (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
            className={s.cls} stroke="currentColor" strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset} strokeLinecap="butt" />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

function PublicVerificationView() {
  const data = {
    batchId: "BATCH-2026-08-0142",
    polymerType: "rPET",
    grade: "Injection Molding Grade IM-450",
    manufacturer: "Rhein Polymer Recycling GmbH",
    recycled: 65,
    bio: 0,
    carbon: 1.42,
    hash: illustrativeHash("BATCH-2026-08-0142-issued-record"),
  };
  const circularity = data.recycled + data.bio;

  const timeline = [
    { label: "Batch produced", date: "04 Aug 2026", done: true },
    { label: "ISCC+ mass-balance certified", date: "06 Aug 2026", done: true },
    { label: "LCA independently verified", date: "08 Aug 2026", done: true },
    { label: "Passport issued & signed", date: "09 Aug 2026", done: true },
  ];

  return (
    <div className="max-w-sm mx-auto rounded-[2rem] border-8 border-slate-900 bg-white overflow-hidden shadow-xl">
      <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
        <span className="f-mono text-[11px] tracking-widest text-slate-400">DPP · POLYMER PASSPORT</span>
        <ShieldCheck className="w-4 h-4 text-teal-400" />
      </div>

      <div className="px-5 pt-6 pb-8 space-y-6 bg-slate-50">
        {/* Hero: circularity score */}
        <div className="flex flex-col items-center pt-2">
          <div className="relative">
            <DonutRing recycled={data.recycled} bio={data.bio} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="f-display text-3xl font-semibold text-slate-900">{circularity}%</span>
              <span className="text-[10px] text-slate-500 f-body">circular content</span>
            </div>
          </div>
          <StatusStamp status="ISSUED" />
        </div>

        {/* Material summary */}
        <div className="rounded-xl bg-white border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-teal-700" />
            <span className="f-display text-sm font-semibold text-slate-900">{data.polymerType} · {data.grade}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center pt-2">
            {[
              { label: "PCR content", value: `${data.recycled}%`, cls: "text-teal-700" },
              { label: "Bio-based", value: `${data.bio}%`, cls: "text-emerald-600" },
              { label: "Virgin", value: `${100 - circularity}%`, cls: "text-slate-500" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-slate-50 py-2">
                <div className={`f-mono text-sm font-medium ${s.cls}`}>{s.value}</div>
                <div className="text-[10px] text-slate-400 f-body">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Carbon */}
        <div className="rounded-xl bg-white border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Leaf className="w-4 h-4 text-emerald-600" />
              <span className="f-body text-sm text-slate-700">Carbon footprint</span>
            </div>
            <span className="text-[10px] text-slate-400 f-body">PEF · cradle-to-gate</span>
          </div>
          <span className="f-mono text-lg font-medium text-slate-900">{data.carbon} <span className="text-xs text-slate-400">kgCO₂e/kg</span></span>
        </div>

        {/* Certifications */}
        <div>
          <span className="text-xs f-body font-medium text-slate-500 uppercase tracking-wide">Verified certifications</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {["ISCC PLUS", "GRS", "EN 15343"].map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1 text-[11px] f-body font-medium">
                <BadgeCheck className="w-3.5 h-3.5" /> {c}
              </span>
            ))}
          </div>
        </div>

        {/* Supply chain timeline */}
        <div>
          <span className="text-xs f-body font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Supply chain audit trail
          </span>
          <div className="mt-3 space-y-0">
            {timeline.map((t, i) => (
              <div key={t.label} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-teal-600 mt-1.5" />
                  {i < timeline.length - 1 && <div className="w-px flex-1 bg-slate-200" />}
                </div>
                <div className="pb-4">
                  <div className="text-xs f-body text-slate-800 font-medium">{t.label}</div>
                  <div className="text-[10px] f-mono text-slate-400">{t.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cryptographic fingerprint — same signature device as dashboard */}
        <div className="rounded-xl bg-slate-900 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Hash className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] f-body text-slate-300">Cryptographic record fingerprint</span>
          </div>
          <FingerprintStrip hash={data.hash} tone="amber" />
          <div className="mt-2 text-[10px] f-mono text-slate-500 break-all">{data.hash.slice(0, 32)}…</div>
        </div>

        <div className="text-center pt-1">
          <span className="text-[10px] f-mono text-slate-400">{data.batchId} · {data.manufacturer}</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * ROOT — toggle between the two surfaces for review
 * ==========================================================================*/
export default function App() {
  const [view, setView] = useState("dashboard");
  return (
    <div className="min-h-screen bg-slate-50 f-body">
      <FontImport />
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-center gap-2">
        <button
          onClick={() => setView("dashboard")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium f-body ${
            view === "dashboard" ? "bg-teal-700 text-white" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" /> Manufacturer Dashboard
        </button>
        <button
          onClick={() => setView("public")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium f-body ${
            view === "public" ? "bg-teal-700 text-white" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" /> Public Scan View
        </button>
      </div>
      <div className="px-6 py-8">
        {view === "dashboard" ? <ManufacturerDashboard /> : <PublicVerificationView />}
      </div>
    </div>
  );
}
