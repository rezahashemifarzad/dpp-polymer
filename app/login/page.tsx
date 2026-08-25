/**
 * app/login/page.tsx
 * -----------------------------------------------------------------------
 * Single sign-in page for the new session-based AUDITOR / CUSTOMER login
 * (Role-Based Authentication & Client/Auditor Portal Suite). No role
 * selector — lib/actions/login.ts auto-detects the role by which table the
 * submitted email matches (Auditor.email vs Client.contactEmail).
 *
 * Server Component: if a valid session cookie is already present, redirect
 * straight to the matching portal instead of showing the form again — this
 * one cheap DB read happens only on this page, not on every /portal/*
 * navigation (that's middleware.ts's job, and it stays cookie-presence-only
 * for speed — see that file's own banner).
 *
 * Deliberately a NEW page, not a change to the existing /auditor or
 * /client-portal key-entry gates — those keep working exactly as they do
 * today for anyone already using a personal/company API key.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/session-auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect(session.actorType === "AUDITOR" ? "/portal/auditor" : "/portal/customer");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm bg-slate-900/60 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-teal-500/10 text-teal-400 rounded-lg border border-teal-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide">Sign In</h1>
            <p className="text-xs text-slate-400">Auditor &amp; Client Portal Access</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-4 mb-4 leading-relaxed">
          Sign in with the email and password your administrator set up for you. Auditors and
          customers are routed to their own portal automatically.
        </p>

        <LoginForm />

        <div className="mt-5 pt-4 border-t border-slate-800 text-center">
          <Link href="/" className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300">
            <ArrowLeft className="w-3 h-3" /> Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
