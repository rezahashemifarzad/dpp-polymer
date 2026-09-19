# Fix: Public Verification Pages & QR Codes Generating localhost URLs

**Status:** Complete — code committed to `next.config.ts`. **One manual Vercel dashboard step is required for the fix to take effect** (see below) — this is not something a code change can do on its own.

## The report

"The public verification page and QR codes are generating localhost URLs. We want the application to use the correct production/cloud URL (like our Vercel deployment domain) instead of localhost for all public links and QR code generation."

This is the second time this exact class of bug has surfaced — the first time (see `scripts/backfill-gs1-links.ts`'s own header, and `claude/production-readiness-deployment-checklist-notes.md`) was fixed by manually setting `NEXT_PUBLIC_BASE_URL` in the Vercel dashboard and running a one-off backfill script against the already-created rows. That fix worked, but it depended entirely on a human remembering to keep that dashboard variable set correctly forever — nothing in the code itself prevented it from silently reverting to `localhost` if the variable was ever unset, rescoped to the wrong environment, or the project was reconfigured. This time, the fix is structural rather than another manual patch.

## What generates these URLs

Grepped the whole repo for `NEXT_PUBLIC_BASE_URL`/`localhost` — exactly two places build a base URL from it, both already reading `process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"`:

- `lib/qr.ts`'s `buildGs1VerificationUrl` — server-side, called from `lib/services/create-passport.ts` at passport creation, persisted permanently into that passport's `qrCodePayloadUrl` and `GS1DigitalLink.targetUrl` columns.
- `app/page.tsx`'s live "GS1 URI preview" widget — client-side, mirrors the same value for an in-dashboard preview.

Neither of these needed to change. `.env.local` also has `NEXT_PUBLIC_BASE_URL=http://localhost:3000` in it, but that file is `.gitignore`d (`.env*`) and never reaches Vercel — it's a legitimate local-dev-only setting and was not the cause.

## The fix — `next.config.ts`

Added a `resolveBaseUrl()` function and wired it into Next.js's `env` config key, which bakes a value into `process.env.NEXT_PUBLIC_BASE_URL` at build time, in both the server and client bundles — the exact same mechanism a real `NEXT_PUBLIC_*` dashboard variable uses. Because of that, `lib/qr.ts` and `app/page.tsx` needed **zero code changes** — they keep reading `process.env.NEXT_PUBLIC_BASE_URL` exactly as before; what changes is that this value can no longer silently end up empty.

Resolution order:
1. `NEXT_PUBLIC_BASE_URL`, if explicitly set — always wins (e.g. to point at a real custom domain instead of `*.vercel.app`).
2. `VERCEL_PROJECT_PRODUCTION_URL` — Vercel's own auto-populated, stable production domain (e.g. `dpp-polymer.vercel.app`), constant across every redeploy. This is the one that matters most: it means the app now self-heals to the correct production URL even if nobody ever touches the dashboard variable again.
3. `VERCEL_URL` — the current deployment's own URL. Covers preview deployments (which have no "production" domain of their own).
4. `http://localhost:3000` — true local dev only, when none of the above exist.

Verified against Vercel's and Next.js's own documentation before implementing (not assumed): `VERCEL_PROJECT_PRODUCTION_URL` and `VERCEL_URL` are both confirmed available at build time, and `next.config.js`'s `env` key is confirmed to inline its values into `process.env` at build time in both server and client bundles (Next.js docs call it a "legacy" API but it's still fully supported — it's also the only mechanism that lets this value be *computed* rather than a static `.env` string, which is exactly what's needed here).

## ⚠️ Required manual step — this is not a code fix

Vercel's System Environment Variables (`VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, etc.) are **not exposed by default**. In the Vercel dashboard: **Project → Settings → Environment Variables → check "Enable access to System Environment Variables."** Without that checkbox on, `VERCEL_PROJECT_PRODUCTION_URL`/`VERCEL_URL` are simply undefined at build time and `resolveBaseUrl()` falls all the way through to `localhost` again — silently reproducing the exact same bug. This is the one piece of this fix I cannot do from here (no dashboard access) — please confirm it's checked.

Also worth confirming while there: if `NEXT_PUBLIC_BASE_URL` is still set in the dashboard from the earlier fix, either leave it correctly pointed at `https://dpp-polymer.vercel.app` (or your real domain) or remove it entirely and let the new automatic fallback handle it — an explicit dashboard value always takes priority by design, so a *wrong* explicit value would still override the new safety net.

## Existing data is not retroactively fixed

This fix only affects new passports created **after** the next deploy. Any passports created while the bug was active this second time still have `localhost` baked into their persisted `qrCodePayloadUrl`/`GS1DigitalLink` rows in Neon. Re-run the existing remediation tool once the fix is deployed and confirmed working:
```
NEXT_PUBLIC_BASE_URL=https://your-real-domain.example npx tsx scripts/backfill-gs1-links.ts
```

## Verified, not changed

Syntax-checked both changed files with `esbuild` (no `node_modules`/Prisma client available in the sandbox for a full `tsc --noEmit`, same caveat as prior sessions). Confirmed via Vercel's and Next.js's own current documentation (fetched directly, not assumed from training knowledge) that `env` in `next.config.js` still bakes values into both bundles at build time, and that `VERCEL_PROJECT_PRODUCTION_URL`/`VERCEL_URL` are both populated at build time. Confirmed via repo-wide grep that no other file independently reconstructs a base URL — `lib/services/generate-certificate-pdf.tsx`, `lib/services/generate-qr-label-sheet-pdf.tsx`, `lib/qr-image.ts`, and the public resolver page (`app/01/[gtin]/21/[serialOrBatch]/page.tsx`) all consume the already-persisted `qrCodePayloadUrl`, never rebuild it — so this one fix covers every public link and QR code the app generates, with no other file needing a matching change. Also brought `scripts/seed-sample-passports.ts` (this session's earlier deliverable) in line with the same fallback chain, since it runs outside the Next.js build and wouldn't otherwise benefit from the `next.config.ts` fix.
