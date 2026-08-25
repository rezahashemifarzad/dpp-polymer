"use client";

/**
 * app/login/LoginForm.tsx
 * -----------------------------------------------------------------------
 * Client-side form for app/login/page.tsx. Calls lib/actions/login.ts's
 * loginAction directly — a successful login redirects server-side (via
 * Next's redirect() inside the action), so this component only ever needs
 * to handle the FAILURE path (loginAction returns {ok:false, error} instead
 * of resolving normally, since Next's redirect() never returns to here).
 *
 * Styled to match the existing key-entry gates (app/auditor/page.tsx's
 * AuditorGate, app/client-portal/page.tsx's ClientGate) for visual
 * consistency across every sign-in surface this app has.
 */

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, LogIn } from "lucide-react";
import { loginAction } from "@/lib/actions/login";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await loginAction(formData);
      // A successful login calls redirect() inside the action and never
      // resolves to a value here — only the failure path returns.
      if (result && !result.ok) {
        setError(result.error ?? "Something went wrong. Please try again.");
      }
    });
  };

  return (
    <form action={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="login-email" className="block text-xs font-medium text-slate-400 mb-1.5">
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="you@company.com"
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50"
        />
      </div>
      <div>
        <label htmlFor="login-password" className="block text-xs font-medium text-slate-400 mb-1.5">
          Password
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold py-2.5 rounded-lg text-sm transition-all"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
        Sign In
      </button>
    </form>
  );
}
