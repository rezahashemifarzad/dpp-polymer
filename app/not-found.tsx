/**
 * app/not-found.tsx
 * -----------------------------------------------------------------------
 * Branded 404 for every route without its own not-found boundary
 * (repository audit 2026-10-22). Previously the app fell through to the
 * framework's default unstyled 404. It is also what a scanned QR code shows
 * when its batch ID does not exist (app/01/[gtin]/21/[serialOrBatch] calls
 * notFound()), so the copy speaks to both website visitors and people who
 * scanned a product label.
 *
 * There is no reliable locale at this point (the URL is unknown), so the
 * message is shown in all three site languages, each marked with `lang` so
 * screen readers switch pronunciation correctly.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";

export const metadata: Metadata = {
  title: "Page not found · DPP-Polymer",
  robots: { index: false, follow: false },
};

const MESSAGES = [
  {
    lang: "en",
    title: "Page not found",
    body: "This page or product passport does not exist. If you scanned a QR code, check the code on the label or contact the manufacturer.",
  },
  {
    lang: "de",
    title: "Seite nicht gefunden",
    body: "Diese Seite oder dieser Produktpass existiert nicht. Wenn Sie einen QR-Code gescannt haben, prüfen Sie den Code auf dem Etikett oder wenden Sie sich an den Hersteller.",
  },
  {
    lang: "fr",
    title: "Page introuvable",
    body: "Cette page ou ce passeport produit n'existe pas. Si vous avez scanné un code QR, vérifiez le code sur l'étiquette ou contactez le fabricant.",
  },
] as const;

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-1 items-center justify-center bg-slate-50 px-5 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900">
          <SearchX className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <p className="font-mono text-xs font-semibold tracking-widest text-slate-500">404</p>
        <div className="mt-3 space-y-5">
          {MESSAGES.map((m, i) => (
            <div key={m.lang} lang={m.lang}>
              {i === 0 ? (
                <h1 className="text-lg font-semibold text-slate-900">{m.title}</h1>
              ) : (
                <h2 className="text-base font-semibold text-slate-900">{m.title}</h2>
              )}
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{m.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
          >
            <span lang="en">Home</span>
            <span aria-hidden="true">&nbsp;·&nbsp;</span>
            <span lang="de">Startseite</span>
            <span aria-hidden="true">&nbsp;·&nbsp;</span>
            <span lang="fr">Accueil</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
