# Role-Based Authentication & Client/Auditor Portal Suite

## What this delivers

Real credential-based (email + password) login for the AUDITOR and CUSTOMER
roles, landing signed-in users on two new read-only protected portals —
`/portal/auditor` and `/portal/customer` — plus a discoverable "Log in for
detailed audit logs & client view" link on the public passport page.
ADMIN login was explicitly deferred (confirmed with the user); the admin
console keeps its existing `DPP_ADMIN_API_KEY` gate.

This is a **parallel** auth path, not a replacement. Every existing thing
keeps working exactly as before, unmodified:

- `/auditor` and `/client-portal` — the personal/company API-key,
  sessionStorage-backed portals, with their full review/sign-off workflows.
- `lib/auditor-auth.ts`, `lib/client-auth.ts`, `lib/rbac.ts` — all
  untouched.
- Every `/api/auditor/*` and `/api/v1/client/*` route — same URL, same
  auth, same response shape.

## New surfaces

- `/login` — single email/password form (no role selector; auto-detects
  AUDITOR vs CUSTOMER by which table the email matches) → redirects to the
  matching portal.
- `/portal/auditor` — read-only view of the shared PENDING_VERIFICATION
  queue. Formal sign-off (approve/reject) intentionally stays on `/auditor`,
  since that action's tamper-evidence story depends on the auditor's own
  personal API key, not a cookie session.
- `/portal/customer` — read-only view of the signed-in buyer's purchased
  batches, reusing `lib/services/get-client-portfolio.ts` unchanged.
- Both portals mount the existing `<AiAssistantWidget scope="public" />`
  unchanged, per the request's instruction to reuse the public/client-scoped
  assistant as-is.

## Schema (additive only)

- `Auditor.passwordHash` / `Client.passwordHash` — nullable, scrypt-hashed
  (see `lib/password.ts`), independent of the existing `apiKeyHash`.
- New `Session` model + `SessionActorType` enum (`AUDITOR` | `CUSTOMER`) —
  `actorType` + `actorId` string pointer instead of a typed relation
  (Prisma has no native polymorphic FK).

## Security design

- **Middleware (`middleware.ts`, new) is a fast cookie-presence gate only**
  — not the auth boundary. The real check is
  `requireAuditorSession()`/`requireClientSession()` (`lib/session-auth.ts`),
  called at the top of each protected page, which resolves the session
  against the DB and redirects to `/login` (no/expired session) or to the
  visitor's own correct portal (right session, wrong portal). This split
  avoids relying on Next.js middleware as a sole security boundary.
- `middleware.ts` imports only `lib/session-constants.ts` (a
  zero-dependency module holding just the cookie name) — never
  `lib/session-auth.ts` itself, which pulls in Prisma Client and would
  break the Edge runtime bundle.
- Login/logout are Server Actions only (`lib/actions/login.ts`,
  `lib/actions/logout.ts`) — no REST route — so they get Next.js's built-in
  same-origin verification for free, in an app with no other CSRF
  protection.
- Passwords are hashed with Node's built-in `crypto.scrypt`
  (`lib/password.ts`) — deliberately NOT the SHA-256 used for `apiKeyHash`/
  session `tokenHash` elsewhere in this schema, since that's only safe for
  hashing high-entropy random tokens, not human-chosen passwords.
- The "unknown email" login branch pays an equivalent scrypt cost
  (`dummyVerifyDelay()`) so response timing can't distinguish "no such
  account" from "wrong password."
- `getAuditorQueue()` was extracted from `app/api/auditor/queue/route.ts`
  into `lib/services/get-auditor-queue.ts` so the existing REST route and
  the new portal page share one implementation — the route itself is
  otherwise unchanged.

## A bug caught during implementation

`util.promisify(crypto.scrypt)`'s TypeScript typings only resolve against
the *last* overload of `scrypt` (the no-options 4-arg form), so passing the
`{N, r, p}` options object through the promisified function failed to
type-check. Fixed by hand-writing a small `scryptAsync()` Promise wrapper
around the callback form instead of relying on `promisify`.

## Verification performed

- `tsc --noEmit` across the repo — every error touching a new/changed file
  is the same pre-existing, sandbox-only cascade already documented in
  prior sprints (`prisma generate` has no network access here, so
  `@prisma/client`'s generated types don't include the new schema fields
  yet — this resolves itself on a real `prisma generate`/deploy).
- Standalone Node unit tests (mocked `next/headers`, `next/navigation`, and
  `@/lib/prisma` via esbuild aliasing into one bundle): 16/16 passing for
  `lib/session-auth.ts` (session create/resolve/expire/destroy, wrong-actor
  redirects, inactive-actor rejection) and 11/11 passing for
  `lib/password.ts` (hash/verify round-trip, wrong-password rejection,
  malformed-hash fail-closed behavior, per-hash random salting).
- Playwright screenshot check (360/768/1440px) of the public scan page's
  new login CTA against the real compiled Tailwind output caught a real
  overflow risk — the CTA originally lived inline in the dark top bar next
  to the language switcher and status badge, which would crowd out at
  360px. Fixed by moving it to its own full-width strip beneath the header;
  re-verified with zero overflow at all three widths.

## Follow-ups (out of scope for this pass)

- ADMIN credential-based login (a real `AdminUser` model) — deferred per
  the user's decision; the admin console keeps its API-key gate.
- No rate limiting on `/login` — matches the rest of this app, which has
  none anywhere today; flagged as a known MVP gap.
- No "sign out everywhere" action — logout only clears the current
  session; the `Session` model's `@@index([actorType, actorId])` is there
  for exactly this if it's wanted later.
