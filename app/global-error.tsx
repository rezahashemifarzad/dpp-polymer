"use client";

/**
 * app/global-error.tsx
 * -----------------------------------------------------------------------
 * Last-resort boundary for errors thrown in the root layout itself (e.g. the
 * LanguageProvider or SiteNav), which app/error.tsx cannot catch because it
 * renders inside that layout (repository audit 2026-10-22). It replaces the
 * whole document, so it renders its own <html>/<body> and uses inline styles
 * only — no dependency on the global stylesheet or fonts having loaded.
 */

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Unhandled root layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          color: "#0f172a",
          padding: "24px",
        }}
      >
        <main
          role="alert"
          style={{
            maxWidth: 480,
            width: "100%",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: 32,
          }}
        >
          <h1 style={{ fontSize: 18, margin: 0 }}>DPP-Polymer is temporarily unavailable</h1>
          <p lang="de" style={{ fontSize: 14, color: "#475569", margin: "8px 0 0" }}>
            DPP-Polymer ist vorübergehend nicht erreichbar.
          </p>
          <p lang="fr" style={{ fontSize: 14, color: "#475569", margin: "4px 0 0" }}>
            DPP-Polymer est temporairement indisponible.
          </p>
          {error.digest && (
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#64748b", marginTop: 16 }}>
              Ref: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              background: "#0f172a",
              color: "#ffffff",
              border: 0,
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again · Erneut versuchen · Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
