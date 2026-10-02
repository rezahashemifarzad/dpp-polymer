# Access-control matrix — Polymer DPP

Last audit: 2026-09-30. Enforced by code in `lib/session-auth.ts`, `lib/api-auth.ts`, `lib/rbac.ts`, `lib/auditor-auth.ts`, `lib/client-auth.ts`, `lib/erp-auth.ts` and `lib/supplier-invite-auth.ts`. Regression-checked by `npm run check:access` (also runs before every `npm run build`).

## Principles

1. **Server-side enforcement only counts.** Middleware and hidden buttons are UX. Every page, Route Handler and Server Action re-checks the caller itself.
2. **Deny by default.** A new API route or Server Action fails the build unless it calls a guard or is added to the public allow-list in `scripts/check-access-control.ts` with a reason.
3. **Least privilege.** Auditors verify and read audit data; they cannot configure the platform, manage accounts or revoke passports. Customers and suppliers only reach their own scoped data.
4. **Deactivation is immediate.** Sessions resolve the actor row on every request; `active = false` locks the account out on its next request.

## Identities

| Identity | How it authenticates | Resolved by |
| --- | --- | --- |
| Guest | nothing | — |
| Admin | `/login` password → `dpp_session` cookie | `requireAdminSession()`, `getSessionActor()` |
| Auditor | `/login` password → cookie; or personal key `x-dpp-auditor-key` | `requireAuditorSession()`, `authorizeAuditor()` |
| Customer (buyer) | `/login` password → cookie; or `x-dpp-client-key` | `requireClientSession()`, `authorizeClient()` |
| Supplier | single-use invite link token | `resolveSupplierInvite()` |
| Machine callers | shared role key `x-dpp-api-key` (ADMIN / AUDITOR / MANUFACTURER); ERP key `x-dpp-manufacturer-key`; `CRON_SECRET` | `authorize()`, `authorizeManufacturer()` |

## Pages

| Route | Guest | Admin | Auditor | Customer |
| --- | --- | --- | --- | --- |
| `/` Home | read-only (public projection, no management controls) | full console | read-only | read-only |
| `/01/{gtin}/21/{batch}` public passport | read | read | read | read |
| `/admin/*` | → `/login` | full | → `/portal/auditor` | → `/portal/customer` |
| `/portal/auditor` | → `/login` | → `/admin` | own queue | → `/portal/customer` |
| `/portal/customer` | → `/login` | → `/admin` | → `/portal/auditor` | own purchased batches only |
| `/auditor`, `/client-portal` (legacy key gates) | key prompt only; all data via key-authenticated APIs | | | |
| `/supplier/submit/{token}` | valid token only; submits for admin review | | | |

## API routes

| Route | Method | Allowed |
| --- | --- | --- |
| `/api/passports` | GET | **Public projection** for guests/customers (ISSUED/REVOKED/SUPERSEDED, verified certificates and custody records only); full records for ADMIN/AUDITOR session or ADMIN/AUDITOR/MANUFACTURER key |
| `/api/passports` | POST | ADMIN or MANUFACTURER key |
| `/api/passports/analytics` | GET | Public (aggregate monthly counts only) |
| `/api/passports/{batchId}/certificate.pdf` | GET | Public (linked from the public passport page) |
| `/api/passports/{batchId}` | GET | ADMIN, AUDITOR, MANUFACTURER |
| `/api/passports/{batchId}` | PATCH | ISSUED: AUDITOR or ADMIN key. REVOKED / SUPERSEDED: ADMIN only |
| `/api/passports/{batchId}/verify`, `…/chain-of-custody/{recordId}` | PATCH | individual auditor key |
| `/api/passports/{batchId}/chain-of-custody` | GET | ADMIN, AUDITOR, MANUFACTURER |
| `/api/passports/{batchId}/{certifications,parents,carbon-footprint,svhc,ppwr,chain-of-custody}` | POST/PATCH | ADMIN or MANUFACTURER key |
| `/api/passports/{batchId}/green-valuation` | GET/POST | ADMIN key |
| `/api/passports/svhc-alerts` | GET | ADMIN, AUDITOR |
| `/api/passports/ledger-export.xlsx`, `compliance-report.pdf`, `esg-analytics-export.xlsx` | GET | ADMIN, AUDITOR |
| `/api/passports/green-tax-export.xlsx`, `green-tax-report.pdf` | GET | ADMIN |
| `/api/passports/label-sheet.pdf` | GET | ADMIN, MANUFACTURER |
| `/api/audit-log`, `/api/audit-log/verify`, `/api/audit-log/export.xlsx` | GET | ADMIN, AUDITOR |
| `/api/certifications/expiry-alerts` | GET | ADMIN, AUDITOR |
| `/api/certifications/{id}` | PATCH | AUDITOR or ADMIN key |
| `/api/certifications/{id}/acknowledge-alert` | POST | ADMIN key |
| `/api/certifications/expiry-check`, `/api/notifications/sweep` | GET | `CRON_SECRET` (fails closed when unset) |
| same | POST | ADMIN key |
| `/api/notifications/log`, `settings` (GET), `webhooks` (GET) | GET | ADMIN |
| `/api/notifications/settings` (PUT), `webhooks/**` (POST/PATCH/DELETE) | write | ADMIN key |
| `/api/form-suggestions` | GET | ADMIN, MANUFACTURER |
| `/api/green-accounting/**` | all | ADMIN key |
| `/api/admin/**` | all | ADMIN key |
| `/api/auditor/{me,queue,coc-queue}` | GET | individual auditor key |
| `/api/v1/client/{me,passports}` | GET | client key; data scoped to that client |
| `/api/erp/passports` | POST | manufacturer ERP key; `manufacturerId` forced to the caller |
| `/api/supplier/invite/{token}` | GET/POST | valid, active, unexpired invite token |
| any passport `DELETE` | DELETE | always 405 (no hard deletes) |

"Session or key" routes (`authorizeApiRequest`) accept a signed-in session of an allowed role **or** a matching API key. No credential → 401. A valid credential for the wrong role → 403.

## Server Actions (`lib/actions`)

Every action calls `requireAdminSession()` first, outside its try/catch, except:

| Action | Why public |
| --- | --- |
| `loginAction`, `logoutAction` | authentication itself |
| `askPublicAssistantAction` | answers only from public passport data |
| `getViewerRoleAction` | returns only the caller's own role name, used to hide nav links |

## Known limits and follow-ups

- No login rate limiting or lockout yet. Add per-IP and per-account throttling before a public launch.
- Shared role keys (`x-dpp-api-key`) are coarse. Prefer per-integration keys (like the ERP and auditor keys) for new partners.
- Admin sessions are all-powerful; there is no finer admin sub-role yet.
- Middleware is only a cookie-presence fast path. The page, layout and handler checks are the real boundary.
