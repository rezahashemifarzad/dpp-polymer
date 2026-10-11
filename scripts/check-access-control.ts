/**
 * scripts/check-access-control.ts
 * -----------------------------------------------------------------------
 * Access-control audit (2026-09-30) — static regression check. Fails (exit 1)
 * when a Route Handler or Server Action ships without an authorization guard
 * and is not on the explicit public allow-list below.
 *
 *   npx tsx scripts/check-access-control.ts
 *
 * Rules:
 *   - app/api/** /route.ts: every exported GET/POST/PUT/PATCH/DELETE handler
 *     must call a recognised guard, unless "<route> <METHOD>" is listed in
 *     PUBLIC_ROUTES (or the handler only returns the no-hard-delete 405).
 *   - lib/actions/*.ts: every exported async function must call
 *     requireAdminSession() (or another require*Session()), unless listed in
 *     PUBLIC_ACTIONS.
 *
 * This is a lint, not a proof: it checks that a guard is CALLED in the
 * handler body, so a reviewer must still confirm the right roles are passed.
 * Adding something to an allow-list is a deliberate, reviewable decision.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";

const ROOT = process.cwd();

/** Routes intentionally reachable without a session or API key. */
const PUBLIC_ROUTES = new Set<string>([
  // Public list for the Home page — returns only the public projection to guests.
  "app/api/passports GET",
  // Aggregate monthly counts for the Home trend chart; no record-level data.
  "app/api/passports/analytics GET",
  // Certificate of Conformity linked from the public QR scan page.
  "app/api/passports/[batchId]/certificate.pdf GET",
  // Cron entry points: authorized by CRON_SECRET (fail closed when unset).
  "app/api/notifications/sweep GET",
  "app/api/certifications/expiry-check GET",
]);

/** Server Actions intentionally callable without an admin session. */
const PUBLIC_ACTIONS = new Set<string>([
  "lib/actions/login.ts loginAction",
  "lib/actions/logout.ts logoutAction",
  "lib/actions/ask-assistant.ts askPublicAssistantAction",
  "lib/actions/get-viewer-role.ts getViewerRoleAction",
  // Landing-page inquiry form: visitors have no session. Sends one email to
  // the fixed contact mailbox only; reads and writes no platform data.
  "lib/actions/submit-inquiry.ts submitInquiryAction",
]);

const ROUTE_GUARDS = [
  "authorizeApiRequest(",
  "authorize(req",
  "authorizeAuditor(",
  "authorizeClient(",
  "authorizeManufacturer(",
  "resolveSupplierInvite(",
  "isAuthorizedCronRequest(",
];

const ACTION_GUARDS = ["requireAdminSession(", "requireAuditorSession(", "requireClientSession("];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Returns the body text of `export async function NAME(...) { ... }` via brace matching. */
function functionBodies(source: string): { name: string; body: string }[] {
  const results: { name: string; body: string }[] = [];
  const re = /export\s+async\s+function\s+(\w+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    // Skip the parameter list (may contain nested parens/braces in types).
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < source.length && depth > 0) {
      if (source[i] === "(") depth++;
      else if (source[i] === ")") depth--;
      i++;
    }
    // The body's opening brace is the first "{" outside any generic "<...>"
    // in the return type (e.g. Promise<{ ok: boolean }>).
    let angle = 0;
    let start = i;
    for (; start < source.length; start++) {
      const c = source[start];
      if (c === "<") angle++;
      else if (c === ">" && source[start - 1] !== "=") angle--;
      else if (c === "{" && angle <= 0) break;
    }
    let j = start + 1;
    depth = 1;
    while (j < source.length && depth > 0) {
      if (source[j] === "{") depth++;
      else if (source[j] === "}") depth--;
      j++;
    }
    results.push({ name: m[1], body: source.slice(start, j) });
  }
  return results;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const failures: string[] = [];

// --- Route Handlers ---------------------------------------------------------
for (const file of walk(join(ROOT, "app", "api")).filter((f) => f.endsWith(`${sep}route.ts`))) {
  const rel = relative(ROOT, file).split(sep).join("/");
  const route = rel.replace(/\/route\.ts$/, "");
  const src = stripComments(readFileSync(file, "utf8"));
  for (const { name, body } of functionBodies(src)) {
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(name)) continue;
    if (PUBLIC_ROUTES.has(`${route} ${name}`)) continue;
    if (body.includes("NO_HARD_DELETE_POLICY_MESSAGE") && body.includes("status: 405")) continue;
    if (!ROUTE_GUARDS.some((g) => body.includes(g))) failures.push(`UNGUARDED ROUTE  ${route} ${name}`);
  }
}

// --- Server Actions ---------------------------------------------------------
for (const file of walk(join(ROOT, "lib", "actions")).filter((f) => f.endsWith(".ts"))) {
  const rel = relative(ROOT, file).split(sep).join("/");
  const src = stripComments(readFileSync(file, "utf8"));
  if (!/^\s*["']use server["']/.test(src)) continue;
  for (const { name, body } of functionBodies(src)) {
    if (PUBLIC_ACTIONS.has(`${rel} ${name}`)) continue;
    if (!ACTION_GUARDS.some((g) => body.includes(g))) failures.push(`UNGUARDED ACTION ${rel} ${name}`);
  }
}

if (failures.length > 0) {
  console.error(`Access-control check FAILED — ${failures.length} unguarded entry point(s):\n`);
  for (const f of failures) console.error(`  ${f}`);
  console.error("\nGuard it, or add it to the public allow-list in scripts/check-access-control.ts with a reason.");
  process.exit(1);
}
console.log("Access-control check passed: every API route and Server Action is guarded or explicitly public.");
