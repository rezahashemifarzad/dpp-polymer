"use client";

/**
 * components/dashboard/access-control/access-control-dashboard.tsx
 * -----------------------------------------------------------------------
 * Admin UI for Auditor & Buyer Accounts — self-service provisioning and
 * management for Auditor and Client (buyer company) accounts, previously
 * only reachable via CLI scripts run on a developer's machine
 * (scripts/create-auditor.ts, scripts/create-client.ts,
 * scripts/set-auditor-password.ts, scripts/set-client-password.ts). Those
 * scripts are untouched and still work standalone — this is the same
 * capability, reachable from the admin console instead.
 *
 * Structurally mirrors components/dashboard/supplier-review-panel.tsx's
 * co-location convention (several related sub-components in one file,
 * all revolving around the same small set of actions) and its
 * "raw secret shown ONCE" modal pattern (see that file's InviteModal).
 * Two near-identical panels — AuditorAccountsPanel and
 * ClientAccountsPanel — stay separate rather than one generic
 * actor-parameterized component, mirroring lib/client-auth.ts vs
 * lib/auditor-auth.ts's own "small duplication over premature
 * abstraction" precedent: the two entities have different field shapes
 * (name+organization vs companyName+country). The two account-management
 * MODALS (RotateKeyModal, PasswordModal) below ARE shared, since their
 * mechanics are pure UI plumbing, not domain logic — each panel injects
 * its own Server Action via a prop.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  RefreshCw,
  UserPlus,
  Copy,
  Check,
  KeyRound,
  Lock,
  Ban,
  CheckCircle2,
  ShieldCheck,
  Building2,
  X,
} from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
// Global Language Translation for Page Content fix (2026-09-27) — this
// dashboard previously had no useLanguage() import at all (see
// accounts-page-header.tsx's own banner: only that tiny title/subtitle
// header component was wired up). Both panels below now translate their
// own section header and table columns the same way every other admin
// dashboard does.
import { useLanguage } from "@/lib/hooks/use-language";
import {
  listAuditorAccountsAction,
  createAuditorAccountAction,
  setAuditorActiveAction,
  rotateAuditorApiKeyAction,
  setAuditorPasswordAction,
} from "@/lib/actions/manage-auditor-accounts";
import {
  listClientAccountsAction,
  createClientAccountAction,
  setClientActiveAction,
  rotateClientApiKeyAction,
  setClientPasswordAction,
} from "@/lib/actions/manage-client-accounts";

const inputCls =
  "w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500";

interface AuditorRow {
  id: string;
  name: string;
  organization: string;
  email: string | null;
  active: boolean;
  hasPassword: boolean;
  createdAt: string;
}

interface ClientRow {
  id: string;
  companyName: string;
  country: string | null;
  contactEmail: string | null;
  active: boolean;
  hasPassword: boolean;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Shared: a raw secret (API key or, in principle, anything else) shown
// exactly once, with a copy button. Same convention as
// supplier-review-panel.tsx's InviteModal "created" state.
// ----------------------------------------------------------------------------
function CopyableSecretBox({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable — the value is still selectable
      // in the box below, so this is a soft failure, not a blocker.
    }
  };
  return (
    <>
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-emerald-400 break-all mb-3">
        {value}
      </div>
      <button
        onClick={handleCopy}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs mb-3"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 relative shadow-2xl my-8">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-800"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Shared modal: rotate an account's API key. `rotate` is injected by the
// calling panel (auditor vs client) so this component has no knowledge of
// which entity it's operating on.
// ----------------------------------------------------------------------------
function RotateKeyModal({
  name,
  onClose,
  onRotated,
  rotate,
}: {
  name: string;
  onClose: () => void;
  onRotated: () => void;
  rotate: () => Promise<{ ok: boolean; data?: { rawApiKey: string }; error?: string }>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawApiKey, setRawApiKey] = useState<string | null>(null);

  const handleRotate = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await rotate();
      if (!result.ok || !result.data) {
        throw new Error(result.error || "Failed to rotate API key");
      }
      setRawApiKey(result.data.rawApiKey);
      onRotated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rotate API key");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      {rawApiKey ? (
        <>
          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            New API key issued
          </h3>
          <p className="text-xs text-slate-400 mb-4 font-mono">
            The previous key for {name} no longer works. Shown ONCE — it cannot be recovered after you close this
            dialog; rotate again to issue a new one.
          </p>
          <CopyableSecretBox value={rawApiKey} />
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs"
          >
            Done
          </button>
        </>
      ) : (
        <>
          <h3 className="text-lg font-bold text-white mb-1">Rotate API Key</h3>
          <p className="text-xs text-slate-400 mb-4 font-mono">
            Issue a new personal API key for {name}. The current key will stop working immediately — anywhere it's
            in use will need the new one.
          </p>
          {error && (
            <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-300">
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleRotate}
              disabled={submitting}
              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2 text-xs"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {submitting ? "Rotating..." : "Rotate Key"}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 text-xs">
              Cancel
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

// ----------------------------------------------------------------------------
// Shared modal: set/reset an account's /login password. `setPassword` is
// injected the same way `rotate` is above.
// ----------------------------------------------------------------------------
function PasswordModal({
  name,
  hasPassword,
  onClose,
  onSet,
  setPassword,
}: {
  name: string;
  hasPassword: boolean;
  onClose: () => void;
  onSet: () => void;
  setPassword: (password: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [password, setPasswordValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await setPassword(password);
      if (!result.ok) {
        throw new Error(result.error || "Failed to set password");
      }
      onSet();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <h3 className="text-lg font-bold text-white mb-1">{hasPassword ? "Reset" : "Set"} Password</h3>
      <p className="text-xs text-slate-400 mb-4 font-mono">
        {hasPassword ? "Replaces" : "Sets"} the /login password for {name}. Share it with them directly — it is not
        emailed automatically.
      </p>
      {error && (
        <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-300">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3 font-mono text-xs">
        <label className="block">
          <span className="text-slate-400 block mb-1">New Password (min. 8 characters)</span>
          <input
            type="text"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPasswordValue(e.target.value)}
            className={inputCls}
            autoComplete="off"
          />
        </label>
        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? "Saving..." : hasPassword ? "Reset Password" : "Set Password"}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 text-xs">
            Cancel
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ----------------------------------------------------------------------------
// Status / password chips — small, color-coded, never color alone (same
// accessibility convention as SvhcStatusBadge and ExpiryAlertBadge).
// ----------------------------------------------------------------------------
function StatusChip({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full font-semibold whitespace-nowrap">
      <CheckCircle2 className="w-3 h-3" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-slate-500/10 text-slate-400 border border-slate-500/30 rounded-full font-semibold whitespace-nowrap">
      <Ban className="w-3 h-3" /> Deactivated
    </span>
  );
}

function PasswordChip({ hasPassword }: { hasPassword: boolean }) {
  return hasPassword ? (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full font-semibold whitespace-nowrap">
      <Lock className="w-3 h-3" /> Set
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-slate-500/10 text-slate-500 border border-slate-500/30 rounded-full font-semibold whitespace-nowrap">
      Not Set
    </span>
  );
}

// ----------------------------------------------------------------------------
// Create-Auditor modal
// ----------------------------------------------------------------------------
function CreateAuditorModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ rawApiKey: string; name: string } | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await createAuditorAccountAction({
        name,
        organization,
        email: email || undefined,
        password: password || undefined,
      });
      if (!result.ok || !result.data) {
        throw new Error(result.error || "Failed to create auditor account");
      }
      setCreated({ rawApiKey: result.data.rawApiKey, name: result.data.auditor.name });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create auditor account");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      {created ? (
        <>
          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            Auditor created
          </h3>
          <p className="text-xs text-slate-400 mb-4 font-mono">
            Personal API key for {created.name}. Shown ONCE — give it to them to paste into the Auditor Portal
            (/auditor) sign-in screen; it cannot be recovered after you close this dialog.
          </p>
          <CopyableSecretBox value={created.rawApiKey} />
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs"
          >
            Done
          </button>
        </>
      ) : (
        <>
          <h3 className="text-lg font-bold text-white mb-1">New Auditor</h3>
          <p className="text-xs text-slate-400 mb-4 font-mono">
            Creates an Auditor row with a personal API key (for /auditor sign-off) and, optionally, a password (for
            /login's read-only /portal/auditor view).
          </p>
          {error && (
            <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-300">
              {error}
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-3 font-mono text-xs">
            <label className="block">
              <span className="text-slate-400 block mb-1">Name</span>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="text-slate-400 block mb-1">Organization</span>
              <input required value={organization} onChange={(e) => setOrganization(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="text-slate-400 block mb-1">Email (optional, required for a password)</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="text-slate-400 block mb-1">Password (optional — for /login sign-in)</span>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                autoComplete="off"
                minLength={8}
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {submitting ? "Creating..." : "Create Auditor"}
            </button>
          </form>
        </>
      )}
    </ModalShell>
  );
}

// ----------------------------------------------------------------------------
// Create-Client modal
// ----------------------------------------------------------------------------
function CreateClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ rawApiKey: string; companyName: string } | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await createClientAccountAction({
        companyName,
        country: country || undefined,
        contactEmail: contactEmail || undefined,
        password: password || undefined,
      });
      if (!result.ok || !result.data) {
        throw new Error(result.error || "Failed to create client account");
      }
      setCreated({ rawApiKey: result.data.rawApiKey, companyName: result.data.client.companyName });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create client account");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      {created ? (
        <>
          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            Buyer account created
          </h3>
          <p className="text-xs text-slate-400 mb-4 font-mono">
            Company API key for {created.companyName}. Shown ONCE — give it to them for the Client Portal
            (/client-portal) sign-in screen or their ERP's x-dpp-client-key header; it cannot be recovered after you
            close this dialog.
          </p>
          <CopyableSecretBox value={created.rawApiKey} />
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs"
          >
            Done
          </button>
        </>
      ) : (
        <>
          <h3 className="text-lg font-bold text-white mb-1">New Buyer</h3>
          <p className="text-xs text-slate-400 mb-4 font-mono">
            Creates a Client (buyer company) row with an API key (for /client-portal and the Buyer API) and,
            optionally, a password (for /login's read-only /portal/customer view).
          </p>
          {error && (
            <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-300">
              {error}
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-3 font-mono text-xs">
            <label className="block">
              <span className="text-slate-400 block mb-1">Company Name</span>
              <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="text-slate-400 block mb-1">Country (optional)</span>
              <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="text-slate-400 block mb-1">Contact Email (optional, required for a password)</span>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="text-slate-400 block mb-1">Password (optional — for /login sign-in)</span>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                autoComplete="off"
                minLength={8}
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {submitting ? "Creating..." : "Create Buyer Account"}
            </button>
          </form>
        </>
      )}
    </ModalShell>
  );
}

// ----------------------------------------------------------------------------
// Auditor Accounts panel
// ----------------------------------------------------------------------------
function AuditorAccountsPanel() {
  const { t } = useLanguage();
  const { push } = useToast();
  const [rows, setRows] = useState<AuditorRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [rotateTarget, setRotateTarget] = useState<AuditorRow | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<AuditorRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAuditorAccountsAction();
      if (!result.ok) throw new Error(result.error || "Failed to load auditor accounts");
      setRows((result.data as unknown as AuditorRow[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load auditor accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleActive = async (row: AuditorRow) => {
    setTogglingId(row.id);
    try {
      const result = await setAuditorActiveAction(row.id, !row.active);
      if (!result.ok) throw new Error(result.error || "Failed to update auditor status");
      push({
        variant: "success",
        title: row.active ? "Auditor deactivated" : "Auditor activated",
        description: `${row.name}'s account is now ${row.active ? "deactivated" : "active"}.`,
      });
      await load();
    } catch (err) {
      push({ variant: "error", title: "Couldn't update status", description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white">{t("accounts.section.auditorAccounts")}</h3>
            <p className="text-[11px] text-slate-400 font-mono">
              {loading ? "Loading..." : `${rows?.length ?? 0} auditor account(s)`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition-all"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 text-[11px] bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-2.5 py-1.5 rounded-lg transition-all"
          >
            <UserPlus className="w-3 h-3" />
            New Auditor
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-500/5 border border-red-500/20 rounded-xl text-xs font-mono text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && (rows?.length ?? 0) === 0 && (
        <p className="mt-4 text-xs text-slate-500 font-mono">No auditor accounts yet.</p>
      )}

      {rows && rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs min-w-[720px]">
            <thead>
              <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                <th className="py-2 pr-3">{t("common.name")}</th>
                <th className="py-2 pr-3">{t("accounts.table.organization")}</th>
                <th className="py-2 pr-3">{t("common.email")}</th>
                <th className="py-2 pr-3">{t("common.status")}</th>
                <th className="py-2 pr-3">{t("common.password")}</th>
                <th className="py-2 text-right">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 pr-3 text-slate-200 whitespace-nowrap">{row.name}</td>
                  <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{row.organization}</td>
                  <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{row.email ?? "—"}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <StatusChip active={row.active} />
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <PasswordChip hasPassword={row.hasPassword} />
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <div className="inline-flex gap-1.5">
                      <button
                        onClick={() => setRotateTarget(row)}
                        className="inline-flex items-center gap-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-md transition-all"
                        title="Rotate API key"
                      >
                        <KeyRound className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setPasswordTarget(row)}
                        className="inline-flex items-center gap-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-md transition-all"
                        title={row.hasPassword ? "Reset password" : "Set password"}
                      >
                        <Lock className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(row)}
                        disabled={togglingId === row.id}
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md transition-all disabled:opacity-50 ${
                          row.active
                            ? "bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400"
                            : "bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                        }`}
                      >
                        {togglingId === row.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : row.active ? (
                          <Ban className="w-3 h-3" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        {row.active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateAuditorModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {rotateTarget && (
        <RotateKeyModal
          name={rotateTarget.name}
          onClose={() => setRotateTarget(null)}
          onRotated={load}
          rotate={() => rotateAuditorApiKeyAction(rotateTarget.id)}
        />
      )}
      {passwordTarget && (
        <PasswordModal
          name={passwordTarget.name}
          hasPassword={passwordTarget.hasPassword}
          onClose={() => setPasswordTarget(null)}
          onSet={load}
          setPassword={(password) => setAuditorPasswordAction(passwordTarget.id, password)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Client (Buyer) Accounts panel — mirrors AuditorAccountsPanel exactly,
// see this file's own banner for why these stay separate components.
// ----------------------------------------------------------------------------
function ClientAccountsPanel() {
  const { t } = useLanguage();
  const { push } = useToast();
  const [rows, setRows] = useState<ClientRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [rotateTarget, setRotateTarget] = useState<ClientRow | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<ClientRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listClientAccountsAction();
      if (!result.ok) throw new Error(result.error || "Failed to load client accounts");
      setRows((result.data as unknown as ClientRow[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load client accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleActive = async (row: ClientRow) => {
    setTogglingId(row.id);
    try {
      const result = await setClientActiveAction(row.id, !row.active);
      if (!result.ok) throw new Error(result.error || "Failed to update client status");
      push({
        variant: "success",
        title: row.active ? "Buyer deactivated" : "Buyer activated",
        description: `${row.companyName}'s account is now ${row.active ? "deactivated" : "active"}.`,
      });
      await load();
    } catch (err) {
      push({ variant: "error", title: "Couldn't update status", description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Building2 className="w-5 h-5 text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white">{t("accounts.section.buyerAccounts")}</h3>
            <p className="text-[11px] text-slate-400 font-mono">
              {loading
                ? "Loading..."
                : `${rows?.length ?? 0} buyer account(s) · ${rows?.filter((r) => r.active).length ?? 0} active`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition-all"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 text-[11px] bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 px-2.5 py-1.5 rounded-lg transition-all"
          >
            <UserPlus className="w-3 h-3" />
            New Buyer
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-500/5 border border-red-500/20 rounded-xl text-xs font-mono text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && (rows?.length ?? 0) === 0 && (
        <p className="mt-4 text-xs text-slate-500 font-mono">No buyer accounts yet.</p>
      )}

      {rows && rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs min-w-[720px]">
            <thead>
              <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                <th className="py-2 pr-3">{t("accounts.table.company")}</th>
                <th className="py-2 pr-3">{t("accounts.table.country")}</th>
                <th className="py-2 pr-3">{t("accounts.table.contactEmail")}</th>
                <th className="py-2 pr-3">{t("common.status")}</th>
                <th className="py-2 pr-3">{t("common.password")}</th>
                <th className="py-2 text-right">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 pr-3 text-slate-200 whitespace-nowrap">{row.companyName}</td>
                  <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{row.country ?? "—"}</td>
                  <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{row.contactEmail ?? "—"}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <StatusChip active={row.active} />
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <PasswordChip hasPassword={row.hasPassword} />
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <div className="inline-flex gap-1.5">
                      <button
                        onClick={() => setRotateTarget(row)}
                        className="inline-flex items-center gap-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-md transition-all"
                        title="Rotate API key"
                      >
                        <KeyRound className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setPasswordTarget(row)}
                        className="inline-flex items-center gap-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-md transition-all"
                        title={row.hasPassword ? "Reset password" : "Set password"}
                      >
                        <Lock className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(row)}
                        disabled={togglingId === row.id}
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md transition-all disabled:opacity-50 ${
                          row.active
                            ? "bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400"
                            : "bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                        }`}
                      >
                        {togglingId === row.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : row.active ? (
                          <Ban className="w-3 h-3" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        {row.active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateClientModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {rotateTarget && (
        <RotateKeyModal
          name={rotateTarget.companyName}
          onClose={() => setRotateTarget(null)}
          onRotated={load}
          rotate={() => rotateClientApiKeyAction(rotateTarget.id)}
        />
      )}
      {passwordTarget && (
        <PasswordModal
          name={passwordTarget.companyName}
          hasPassword={passwordTarget.hasPassword}
          onClose={() => setPasswordTarget(null)}
          onSet={load}
          setPassword={(password) => setClientPasswordAction(passwordTarget.id, password)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Page-level export
// ----------------------------------------------------------------------------
export function AccessControlDashboard() {
  return (
    <div className="space-y-6">
      <AuditorAccountsPanel />
      <ClientAccountsPanel />
    </div>
  );
}
