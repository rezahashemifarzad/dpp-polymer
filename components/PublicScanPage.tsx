"use client";

/**
 * components/PublicScanPage.tsx
 * -----------------------------------------------------------------------
 * Rendered by app/01/[gtin]/21/[serialOrBatch]/page.tsx (the GS1 resolver).
 * This is what a B2B buyer, auditor, or inspector sees when they scan the
 * QR code printed on a polymer bag/container.
 *
 * Visual language matches the manufacturer dashboard (PolymerPassportUI.jsx)
 * for brand consistency: slate/teal/amber palette, IBM Plex Sans/Mono, and
 * the same "hash fingerprint" barcode motif used there — this page is
 * where that motif does its real job (proving data integrity), rather
 * than the illustrative preview it was on the dashboard.
 *
 * NOTE: for production, prefer next/font/google over the runtime @import
 * below (avoids a render-blocking font fetch) — kept as @import here only
 * to match the standalone preview artifact byte-for-byte during review.
 */

import { useState, useMemo } from "react";
import {
  ShieldCheck, ShieldAlert, Leaf, Recycle, Layers, Gauge, Hash,
  BadgeCheck, ExternalLink, Download, Copy, Check, AlertTriangle,
  Factory, CalendarDays, Clock, CheckCircle2,
} from "lucide-react";

/* ---------------------------------------------------------------------------
 * Types — mirror the JSON shape page.tsx passes down (Decimals already
 * converted to numbers, Dates already converted to ISO strings).
 * ------------------------------------------------------------------------*/
interface CertificationView {
  scheme: string;
  certificateId: string;
  issuingBody: string;
  validFrom: string;
  validUntil: string;
  documentUrl: string | null;
}

interface PassportView {
  polymerType: string;
  grade: string;
  gtin: string;
  meltFlowIndex: number;
  mfiTestStandard: string;
  density: number;
  densityTestStandard: string;
  recycledContentSource: string | null;
  recycledContentPercent: number;
  bioBasedPercent: number;
  carbonFootprintKgCO2ePerKg: number;
  lcaMethodology: string;
  lcaScope: string;
  lcaThirdPartyVerified: boolean;
  lcaVerifierName: string | null;
  batchId: string;
  productionDate: string;
  status: string;
  manufacturer: { legalName: string; country: string };
  certifications: CertificationView[];
  recordHash: string;
  hashAlgorithm: string;
  previousRecordHash: string | null;
  signedAt: string | null;
}

interface PublicScanPageProps {
  passport: PassportView;
  integrityVerified: boolean;
  linkTrusted: boolean;
}

/* Same fingerprint device used on the dashboard — here driven by the real recordHash. */
function fingerprintBars(hash: string, count = 48) {
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    const byte = parseInt(hash.substr((i * 2) % hash.length, 2), 16) || 0;
    bars.push(10 + (byte / 255) * 90);
  }
  return bars;
}

function FingerprintStrip({ hash, tone }: { hash: string; tone: "teal" | "rose" }) {
  const bars = useMemo(() => fingerprintBars(hash), [hash]);
  const barColor = tone === "teal" ? "bg-teal-500" : "bg-rose-500";
  return (
    <div className="flex items-end gap-[2px] h-12 w-full">
      {bars.map((h, i) => (
        <div key={i} className={`flex-1 ${barColor} rounded-sm`} style={{ height: `${h}%`, opacity: 0.4 + (h / 100) * 0.6 }} />
      ))}
    </div>
  );
}

const CERT_LABELS: Record<string, string> = {
  ISCC_PLUS: "ISCC PLUS",
  REDCERT2: "REDcert2",
  GRS: "Global Recycled Standard",
  RECYCLASS: "RecyClass",
  ISO_14021: "ISO 14021",
  ISO_14040_44: "ISO 14040/44",
  EN_15343: "EN 15343",
  EN_16785: "EN 16785",
  OTHER: "Certification",
};

function certStatus(validUntil: string): { label: string; cls: string; icon: typeof CheckCircle2 } {
  const days = (new Date(validUntil).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return { label: "Expired", cls: "bg-rose-50 text-rose-700 border-rose-200", icon: AlertTriangle };
  if (days < 60) return { label: "Expiring soon", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock };
  return { label: "Valid", cls: "bg-teal-50 text-teal-700 border-teal-200", icon: CheckCircle2 };
}

function CopyableHash({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — silently ignore, the hash is still visible/selectable */
    }
  };
  return (
    <button
      onClick={copy}
      className="w-full flex items-center justify-between gap-2 rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-left hover:bg-slate-700 transition-colors"
    >
      <span className="text-xs f-mono text-slate-300 break-all">{hash}</span>
      {copied ? <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
    </button>
  );
}

export default function PublicScanPage({ passport, integrityVerified, linkTrusted }: PublicScanPageProps) {
  const circularity = passport.recycledContentPercent + passport.bioBasedPercent;
  const virgin = Math.max(0, 100 - circularity);
  const overallTrusted = integrityVerified && linkTrusted;

  return (
    <div className="min-h-screen bg-slate-50 f-body">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .f-display { font-family: 'Space Grotesk', sans-serif; }
        .f-body { font-family: 'IBM Plex Sans', system-ui, sans-serif; }
        .f-mono { font-family: 'IBM Plex Mono', monospace; }
      `}</style>

      {/* Trust banner — only shown when something is actually wrong */}
      {!overallTrusted && (
        <div className="bg-rose-600 text-white text-center py-2 px-4 text-xs f-body font-medium flex items-center justify-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          {!linkTrusted
            ? "This QR link doesn't match our signed record for this batch — verify with the manufacturer before relying on this data."
            : "Data integrity check failed — this record does not match its signed hash."}
        </div>
      )}

      <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-teal-400" />
          <span className="f-mono text-[11px] tracking-widest text-slate-400">DPP · POLYMER PASSPORT</span>
        </div>
        {overallTrusted ? (
          <span className="flex items-center gap-1.5 text-teal-400 text-xs f-body font-medium">
            <ShieldCheck className="w-4 h-4" /> Verified
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-rose-400 text-xs f-body font-medium">
            <ShieldAlert className="w-4 h-4" /> Unverified
          </span>
        )}
      </div>

      <div className="max-w-md mx-auto px-5 py-6 space-y-5">
        {/* Product header */}
        <div>
          <h1 className="f-display text-xl font-semibold text-slate-900">{passport.polymerType} · {passport.grade}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs f-mono text-slate-500">
            <span>GTIN {passport.gtin}</span>
            <span>·</span>
            <span>{passport.batchId}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs f-body text-slate-500">
            <Factory className="w-3.5 h-3.5" /> {passport.manufacturer.legalName} · {passport.manufacturer.country}
          </div>
        </div>

        {/* Technical properties */}
        <section className="rounded-xl bg-white border border-slate-200 p-4">
          <h2 className="f-display text-sm font-semibold text-slate-900 flex items-center gap-1.5 mb-3">
            <Gauge className="w-4 h-4 text-teal-700" /> Technical Properties
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Melt Flow Index", value: `${passport.meltFlowIndex} g/10min`, sub: passport.mfiTestStandard },
              { label: "Density", value: `${passport.density} g/cm³`, sub: passport.densityTestStandard },
            ].map((p) => (
              <div key={p.label} className="rounded-lg bg-slate-50 p-3">
                <div className="text-[10px] text-slate-400 f-body">{p.label}</div>
                <div className="f-mono text-base font-medium text-slate-900">{p.value}</div>
                <div className="text-[10px] text-slate-400 f-body mt-0.5">{p.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Composition */}
        <section className="rounded-xl bg-white border border-slate-200 p-4">
          <h2 className="f-display text-sm font-semibold text-slate-900 flex items-center gap-1.5 mb-3">
            <Recycle className="w-4 h-4 text-teal-700" /> Material Composition
          </h2>
          <div className="flex h-3 w-full overflow-hidden rounded-full border border-slate-200 mb-2">
            <div className="bg-teal-600" style={{ width: `${passport.recycledContentPercent}%` }} />
            <div className="bg-emerald-400" style={{ width: `${passport.bioBasedPercent}%` }} />
            <div className="bg-slate-200" style={{ width: `${virgin}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="f-mono text-sm font-medium text-teal-700">{passport.recycledContentPercent}%</div>
              <div className="text-[10px] text-slate-400 f-body">
                {passport.recycledContentSource === "POST_CONSUMER" ? "Post-Consumer" : passport.recycledContentSource === "POST_INDUSTRIAL" ? "Post-Industrial" : "Recycled"}
              </div>
            </div>
            <div>
              <div className="f-mono text-sm font-medium text-emerald-600">{passport.bioBasedPercent}%</div>
              <div className="text-[10px] text-slate-400 f-body">Bio-based</div>
            </div>
            <div>
              <div className="f-mono text-sm font-medium text-slate-500">{virgin}%</div>
              <div className="text-[10px] text-slate-400 f-body">Virgin</div>
            </div>
          </div>
        </section>

        {/* Carbon footprint */}
        <section className="rounded-xl bg-white border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <h2 className="f-display text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Leaf className="w-4 h-4 text-emerald-600" /> Carbon Footprint
            </h2>
            <div className="text-[10px] text-slate-400 f-body mt-0.5">
              {passport.lcaMethodology} · {passport.lcaScope}
              {passport.lcaThirdPartyVerified && ` · verified by ${passport.lcaVerifierName ?? "third party"}`}
            </div>
          </div>
          <span className="f-mono text-lg font-medium text-slate-900">
            {passport.carbonFootprintKgCO2ePerKg} <span className="text-xs text-slate-400">kgCO₂e/kg</span>
          </span>
        </section>

        {/* Certifications */}
        <section>
          <h2 className="f-display text-sm font-semibold text-slate-900 flex items-center gap-1.5 mb-3">
            <BadgeCheck className="w-4 h-4 text-amber-600" /> Certifications
          </h2>
          <div className="space-y-2">
            {passport.certifications.map((c, i) => {
              const st = certStatus(c.validUntil);
              const StIcon = st.icon;
              return (
                <div key={i} className="rounded-xl bg-white border border-slate-200 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="f-body text-sm font-semibold text-slate-900">{CERT_LABELS[c.scheme] ?? c.scheme}</div>
                      <div className="text-xs f-body text-slate-500 mt-0.5">{c.issuingBody}</div>
                      <div className="text-[11px] f-mono text-slate-400 mt-1">{c.certificateId}</div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] f-body font-medium ${st.cls}`}>
                      <StIcon className="w-3 h-3" /> {st.label}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] f-body">
                    <span className="text-slate-400 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" /> Valid until {new Date(c.validUntil).toLocaleDateString()}
                    </span>
                    {c.documentUrl ? (
                      <a href={c.documentUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-teal-700 font-medium hover:text-teal-800">
                        <Download className="w-3.5 h-3.5" /> Certificate PDF
                      </a>
                    ) : (
                      <span className="text-slate-300">No document on file</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Data Integrity & Cryptographic Security */}
        <section className="rounded-xl bg-slate-900 p-5">
          <h2 className="f-display text-sm font-semibold text-white flex items-center gap-1.5 mb-1">
            <Hash className="w-4 h-4 text-amber-400" /> Data Integrity & Cryptographic Security
          </h2>
          <p className="text-[11px] f-body text-slate-400 mb-3">
            This record was independently re-hashed at the moment you scanned it and compared
            against its signed value — this isn't a stored badge, it's checked live.
          </p>

          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-3 ${
            integrityVerified ? "bg-teal-950/50 border border-teal-800" : "bg-rose-950/50 border border-rose-800"
          }`}>
            {integrityVerified ? (
              <>
                <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
                <span className="text-xs f-body text-teal-300 font-medium">
                  Verified — record matches its signed {passport.hashAlgorithm} hash
                </span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-xs f-body text-rose-300 font-medium">
                  Warning — this record does not match its signed hash
                </span>
              </>
            )}
          </div>

          {!linkTrusted && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3 bg-amber-950/50 border border-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs f-body text-amber-300 font-medium">
                The scanned QR's GTIN or verification token doesn't match this record.
              </span>
            </div>
          )}

          <FingerprintStrip hash={passport.recordHash} tone={integrityVerified ? "teal" : "rose"} />

          <div className="mt-3 space-y-2">
            <div>
              <span className="text-[10px] f-body text-slate-500 block mb-1">recordHash ({passport.hashAlgorithm})</span>
              <CopyableHash hash={passport.recordHash} />
            </div>
            {passport.previousRecordHash && (
              <div>
                <span className="text-[10px] f-body text-slate-500 block mb-1">chained from previous version</span>
                <span className="text-[11px] f-mono text-slate-500 break-all">{passport.previousRecordHash}</span>
              </div>
            )}
            {passport.signedAt && (
              <div className="text-[10px] f-body text-slate-500">
                Signed {new Date(passport.signedAt).toLocaleString()}
              </div>
            )}
          </div>
        </section>

        <div className="text-center pt-1 pb-4">
          <a href="https://gs1.org/standards/digital-link" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] f-body text-slate-400 hover:text-slate-600">
            Resolved via GS1 Digital Link <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
