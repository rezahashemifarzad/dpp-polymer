/**
 * lib/services/ai-assistant.ts
 * -----------------------------------------------------------------------
 * In-Page Floating AI Assistant Widget — the answer engine behind the
 * chat drawer (components/dashboard/ai-assistant-widget.tsx).
 *
 * IMPORTANT — what this actually is: a deterministic, keyword-routed
 * question answerer over this app's own existing services
 * (expiry-alert-service, supplier-analytics, a static compliance
 * glossary, a static navigation index), not a wrapped call to an
 * external LLM API. There is no OPENAI_API_KEY/ANTHROPIC_API_KEY (or any
 * AI SDK) anywhere in this project's dependencies or .env — adding one
 * would mean a new external cost, a new secret to provision, and a new
 * hallucination-risk surface for a compliance-facing product, none of
 * which this request asked for. It explicitly asked for a "lightweight
 * server action... based on existing project services", which is exactly
 * what this is: every figure this returns is computed the same way the
 * rest of the admin console computes it, and every glossary/navigation
 * answer is a static, human-reviewed string, never generated text. If a
 * true generative backend is wanted later, this module's
 * answerAssistantQuestion() is the single seam to swap.
 *
 * Two entry points, deliberately NOT one function with a client-supplied
 * "scope" flag:
 *
 *   - answerAssistantQuestion(question) — the original, unchanged, admin
 *     console entry point. Full intent set below.
 *   - answerPublicAssistantQuestion(question, contextBatchId?) — the
 *     public-page entry point (see PublicScanPage.tsx). Its function body
 *     simply never calls getSupplierAnalytics(), computePortfolioExpiryAlerts(),
 *     the portfolio-count intent, or the admin navigation index — there is
 *     no runtime flag gating that access, because there is no code path to
 *     it at all inside this function. A client-supplied boolean/string
 *     "scope" parameter on a single shared entry point would be a
 *     server-trusting-the-client anti-pattern here: Next.js Server Actions
 *     carry no RBAC of their own (see every lib/actions/* file's own
 *     "needs no RBAC key" reasoning — the REST route is what's gated),
 *     so anyone able to reach the public entry point directly could set
 *     that flag to whatever they wanted. Splitting into two functions
 *     makes "secure isolation from private admin-only metrics" a
 *     structural property of the public path, not a checked permission.
 *
 * answerAssistantQuestion() intents, tried in order, most-specific first,
 * first confident match wins:
 *   1. Specific batch lookup (a batch-id-shaped token in the question)
 *   2. Portfolio batch-count / status-breakdown question
 *   3. Compliance glossary term (ISCC PLUS, PCR/PIR, MFI, ESPR, PPWR,
 *      REACH/SVHC, GS1 Digital Link, mass balance, LCA/PEF, chain of
 *      custody, DPP)
 *   4. Supplier / manufacturer performance ranking question
 *   5. Portfolio-wide certificate expiry / compliance question
 *   6. Navigation help ("where do I find...")
 *   7. Greeting / capability list
 *   8. Fallback — a helpful "here's what I can answer" message
 *
 * answerPublicAssistantQuestion() intents — everything above EXCEPT 2, 4,
 * 5, and 6 (portfolio count, supplier ranking, portfolio expiry, admin
 * nav — all either internal-ops metrics or admin-only routes), PLUS: intent
 * 1's batch lookup defaults to `contextBatchId` (the passport the visitor
 * is currently viewing) when the question doesn't name a different batch,
 * so "is this certified?" or "what's the recycled content?" work without
 * the visitor re-typing a batch ID, and intent 1's link points at that
 * batch's own public GS1 scan page (lib/qr.ts) instead of an admin ledger
 * row. Intent 3's glossary answers drop their admin-page link on the
 * public path for the same reason.
 *
 * Every branch is a pure read against existing tables/services — this
 * module never writes anything, so it needs no audit-log entry (compare
 * lib/audit.ts's own scope: state *changes* get audited, read-only
 * lookups like GET /api/passports do not, and this is squarely the
 * latter).
 */

import { prisma } from "@/lib/prisma";
import { computePortfolioExpiryAlerts } from "@/lib/services/expiry-alert-service";
import { getSupplierAnalytics } from "@/lib/services/supplier-analytics";
import { buildGs1VerificationUrl } from "@/lib/qr";

export interface AssistantLink {
  label: string;
  href: string;
}

export interface AssistantAnswer {
  answer: string;
  links: AssistantLink[];
  /** Which intent matched — surfaced only for the harness/debugging, not shown in the widget UI. */
  intent: string;
}

const MAX_QUESTION_LENGTH = 500;

// ---------------------------------------------------------------------
// Intent 1 — specific batch lookup
// ---------------------------------------------------------------------

// Heuristic, not a full parser: a real batchId always carries a digit
// (every example in this codebase is "BATCH-2026-EU-014"-shaped), so
// requiring one filters out accidental matches on ordinary words that
// happen to follow "batch" (e.g. "batch status" alone should NOT be
// read as a token "status").
function extractBatchIdToken(question: string): string | null {
  const afterKeyword = question.match(/batch(?:\s*id)?\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9_-]{2,40})/i);
  const standalone = question.match(/\b([A-Za-z]{2,}-[A-Za-z0-9-]{2,40})\b/);
  for (const candidate of [afterKeyword?.[1], standalone?.[1]]) {
    if (candidate && /\d/.test(candidate) && candidate.replace(/-/g, "").length >= 4) {
      return candidate;
    }
  }
  return null;
}

// Builds this batch's own public GS1 scan-page link (the same page the
// visitor is presumably already on, or a related batch's equivalent
// page). Falls back to the bare, un-tokened resolver path when
// recordHash isn't sealed yet (buildGs1VerificationUrl throws on a
// missing/short hash — see lib/qr.ts) rather than surfacing no link at
// all; the resolver page itself already handles a missing/mismatched `v`
// token gracefully (linkTrusted: false), it does not 404 on it.
function buildPublicBatchLink(gtin: string, batchId: string, recordHash: string | null): string | null {
  if (!/^\d{14}$/.test(gtin)) return null;
  try {
    return buildGs1VerificationUrl(gtin, batchId, recordHash ?? "").path;
  } catch {
    return `/01/${gtin}/21/${encodeURIComponent(batchId)}`;
  }
}

interface BatchLookupOptions {
  /** The passport currently on-screen (public scan page only) — used when the question names no other batch. */
  contextBatchId?: string;
  /** Public scope: link to the batch's own public GS1 page instead of the admin ledger, and use public-appropriate copy. */
  publicMode?: boolean;
}

async function tryBatchLookup(question: string, opts: BatchLookupOptions = {}): Promise<AssistantAnswer | null> {
  const token = extractBatchIdToken(question) ?? (opts.publicMode ? opts.contextBatchId ?? null : null);
  if (!token) return null;

  const passport = await prisma.polymerPassport.findFirst({
    where: { batchId: { equals: token, mode: "insensitive" } },
    select: {
      batchId: true,
      status: true,
      polymerType: true,
      grade: true,
      totalRecycledPercent: true,
      gtin: true,
      recordHash: true,
      manufacturer: { select: { legalName: true, country: true } },
      certifications: { select: { scheme: true, verificationStatus: true, validUntil: true } },
    },
  });

  if (!passport) {
    return opts.publicMode
      ? {
          answer: `I couldn't find a batch matching "${token}". Double-check the batch ID printed on the product or QR code.`,
          links: [],
          intent: "batch-not-found",
        }
      : {
          answer: `I couldn't find a batch matching "${token}". Double-check the batch ID, or use Global Search to browse batches by grade, polymer type, or status.`,
          links: [{ label: "Open Global Search", href: "/admin/search" }],
          intent: "batch-not-found",
        };
  }

  const now = new Date();
  const expiredCount = passport.certifications.filter((c) => new Date(c.validUntil) < now).length;
  const certSummary =
    passport.certifications.length === 0
      ? "no certifications on file yet"
      : `${passport.certifications.length} certification${passport.certifications.length === 1 ? "" : "s"} (${
          passport.certifications.filter((c) => c.verificationStatus === "VERIFIED").length
        } verified${expiredCount > 0 ? `, ${expiredCount} expired` : ""})`;

  const manufacturerText = passport.manufacturer
    ? `${passport.manufacturer.legalName} (${passport.manufacturer.country})`
    : "no manufacturer on file";

  const link = opts.publicMode
    ? (() => {
        const path = buildPublicBatchLink(passport.gtin, passport.batchId, passport.recordHash);
        return path ? [{ label: `View ${passport.batchId}'s public passport`, href: path }] : [];
      })()
    : [{ label: `View ${passport.batchId} in the Material Ledger`, href: `/admin#batch-row-${encodeURIComponent(passport.batchId)}` }];

  return {
    answer:
      `Batch ${passport.batchId} — status ${passport.status}, ${passport.polymerType} grade "${passport.grade}", ` +
      `${Number(passport.totalRecycledPercent)}% recycled content. Manufacturer: ${manufacturerText}. ` +
      `Certifications: ${certSummary}.`,
    links: link,
    intent: "batch-lookup",
  };
}

// ---------------------------------------------------------------------
// Intent 2 — portfolio batch-count / status breakdown
// ---------------------------------------------------------------------

const PORTFOLIO_COUNT_KEYWORDS = ["how many batch", "total batch", "portfolio size", "number of batches", "batch count", "how many passports"];

async function tryPortfolioCount(question: string): Promise<AssistantAnswer | null> {
  if (!PORTFOLIO_COUNT_KEYWORDS.some((kw) => question.includes(kw))) return null;

  const rows = await prisma.polymerPassport.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const total = rows.reduce((sum: number, r: { _count: { _all: number } }) => sum + r._count._all, 0);
  if (total === 0) {
    return {
      answer: "There are no batches issued yet — use \"Issue New Polymer Passport\" on the Material Ledger to create the first one.",
      links: [{ label: "Open Material Ledger", href: "/admin" }],
      intent: "portfolio-count-empty",
    };
  }

  const byStatus = rows
    .map((r: { status: string; _count: { _all: number } }) => `${r._count._all} ${r.status}`)
    .join(", ");

  return {
    answer: `The portfolio currently holds ${total} batch${total === 1 ? "" : "es"}: ${byStatus}.`,
    links: [{ label: "Open Material Ledger", href: "/admin" }],
    intent: "portfolio-count",
  };
}

// ---------------------------------------------------------------------
// Intent 3 — compliance glossary
// ---------------------------------------------------------------------

interface GlossaryEntry {
  aliases: RegExp[];
  answer: string;
}

const GLOSSARY: GlossaryEntry[] = [
  {
    aliases: [/\biscc\s*plus\b/i],
    answer:
      "ISCC PLUS is a voluntary, mass-balance chain-of-custody certification scheme for bio-based and recycled/circular feedstocks. It lets a manufacturer allocate a verified recycled or bio-based content percentage to a batch even when the physical material is mixed with virgin feedstock in the same process stream, provided the total allocated across all batches never exceeds what was actually input.",
  },
  {
    aliases: [/\bpcr\b/i, /post[-\s]?consumer recycled/i],
    answer:
      "PCR (Post-Consumer Recycled) content is recycled material recovered from products after their intended consumer use — packaging, bottles, end-of-life goods — as opposed to PIR, which is recovered from a manufacturer's own pre-sale scrap.",
  },
  {
    aliases: [/\bpir\b/i, /post[-\s]?industrial recycled/i],
    answer:
      "PIR (Post-Industrial Recycled) content is recycled material recovered from manufacturing scrap or offcuts before a product ever reaches a consumer, as opposed to PCR, which comes from material recovered after consumer use.",
  },
  {
    aliases: [/\bmfi\b/i, /melt flow index/i],
    answer:
      "MFI (Melt Flow Index) measures how easily a molten polymer flows under a standard test load, in g/10min — a key processability indicator for injection molding vs. extrusion vs. blow molding grades. This platform records it against ISO 1133 by default.",
  },
  {
    aliases: [/\bespr\b/i, /ecodesign for sustainable products/i],
    answer:
      "ESPR (Ecodesign for Sustainable Products Regulation) is the EU framework that mandates Digital Product Passports and sets ecodesign requirements — durability, recyclability, recycled content, carbon footprint disclosure — across product categories, polymers included.",
  },
  {
    aliases: [/\bppwr\b/i, /packaging and packaging waste regulation/i],
    answer:
      "PPWR (Packaging and Packaging Waste Regulation) is the EU regulation setting mandatory minimum recycled-content targets for plastic packaging, phased in by year — see the ESG Analytics dashboard's Regulatory Compliance panel for this portfolio's progress against those targets.",
  },
  {
    aliases: [/\breach\b.*(regulation|svhc|chemical)/i, /(regulation|svhc|chemical).*\breach\b/i, /\bsvhc\b/i],
    answer:
      "REACH is the EU's chemical safety regulation; SVHC (Substances of Very High Concern) is REACH's list of substances requiring disclosure above a 0.1% w/w threshold in an article. A polymer's colorAdditives and feedstock sourcing are the fields most likely to intersect SVHC scope.",
  },
  {
    aliases: [/gs1 digital link/i, /\bgs1\b/i],
    answer:
      "GS1 Digital Link is the URI syntax (/01/{GTIN}/10/{BATCH}) this platform uses to encode a batch's QR code — scanning it resolves to that batch's public product passport page, per GS1's standard for connecting a barcode to web content.",
  },
  {
    aliases: [/mass balance/i],
    answer:
      "Mass balance is a chain-of-custody accounting method (used by ISCC PLUS and similar schemes) that lets recycled/bio-based and virgin material be physically mixed in production while still tracking and allocating certified content on paper, batch by batch, as long as total allocations never exceed total certified input.",
  },
  {
    aliases: [/\blca\b/i, /\bpef\b/i, /life cycle assessment/i, /product environmental footprint/i],
    answer:
      "LCA (Life Cycle Assessment) is the methodology behind this platform's carbon footprint figures; PEF (Product Environmental Footprint) is the EU's own harmonized LCA method, which is this platform's default lcaMethodology. Footprints are recorded cradle-to-gate by default and flagged when third-party verified.",
  },
  {
    aliases: [/chain of custody/i, /\bcoc\b/i],
    answer:
      "Chain of Custody, in this platform, is the multi-tier upstream supply chain record attached to a batch — raw material supplier, recycler, compounder, and so on — each tier optionally carrying its own mass-balance certificate. New tiers start PENDING_REVIEW until an Auditor verifies them.",
  },
  {
    aliases: [/digital product passport/i, /\bdpp\b/i],
    answer:
      "A Digital Product Passport (DPP) is a structured, verifiable record of a product's material composition, sustainability metrics, and compliance certifications, accessible via a QR code — the ESPR requirement this entire platform exists to satisfy.",
  },
];

async function tryGlossary(question: string, publicMode = false): Promise<AssistantAnswer | null> {
  for (const entry of GLOSSARY) {
    if (entry.aliases.some((pattern) => pattern.test(question))) {
      return {
        answer: entry.answer,
        // The ESG Analytics link is an admin-console page — never surfaced
        // to a public, unauthenticated visitor.
        links: publicMode ? [] : [{ label: "ESG Analytics — regulatory compliance", href: "/admin/esg-analytics" }],
        intent: "glossary",
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------
// Intent 4 — supplier / manufacturer performance ranking
// ---------------------------------------------------------------------

const SUPPLIER_TOPIC_KEYWORDS = ["supplier", "vendor", "manufacturer"];
const SUPPLIER_RANK_KEYWORDS = ["top", "best", "rank", "performance", "score", "worst", "at risk", "compliant"];

async function trySupplierRanking(question: string): Promise<AssistantAnswer | null> {
  const mentionsSupplierTopic = SUPPLIER_TOPIC_KEYWORDS.some((kw) => question.includes(kw));
  const mentionsRanking = SUPPLIER_RANK_KEYWORDS.some((kw) => question.includes(kw));
  if (!mentionsSupplierTopic || !mentionsRanking) return null;

  const analytics = await getSupplierAnalytics();
  const ranked = analytics.suppliers.filter((s) => s.performanceScore !== null);
  if (ranked.length === 0) {
    return {
      answer: "No supplier has an active batch yet, so there's nothing to rank. Suppliers get a performance score once at least one of their batches is active (not revoked or superseded).",
      links: [{ label: "Open Supplier Rankings", href: "/admin/suppliers" }],
      intent: "supplier-ranking-empty",
    };
  }

  const wantsWorst = question.includes("worst") || question.includes("at risk");
  const top = wantsWorst ? [...ranked].reverse().slice(0, 3) : ranked.slice(0, 3);
  const list = top
    .map((s) => `${s.manufacturerName} — ${s.tier} tier, score ${Math.round(s.performanceScore ?? 0)}/100`)
    .join("; ");

  return {
    answer: `${wantsWorst ? "Lowest-performing" : "Top-performing"} supplier${top.length === 1 ? "" : "s"} by compliance score: ${list}. Ranked across ${ranked.length} of ${analytics.totalSuppliers} suppliers with active batches.`,
    links: [{ label: "Open Supplier Rankings", href: "/admin/suppliers" }],
    intent: "supplier-ranking",
  };
}

// ---------------------------------------------------------------------
// Intent 5 — portfolio-wide certificate expiry / compliance
// ---------------------------------------------------------------------

const EXPIRY_KEYWORDS = ["expir", "certificate", "certification", "compliance", "compliant"];

async function tryPortfolioExpiry(question: string): Promise<AssistantAnswer | null> {
  if (!EXPIRY_KEYWORDS.some((kw) => question.includes(kw))) return null;

  const summary = await computePortfolioExpiryAlerts();
  if (summary.expiredCount === 0 && summary.expiringUrgentCount === 0 && summary.expiringSoonCount === 0) {
    return {
      answer: "No certificates are expired or expiring soon across the portfolio right now — everything currently on file is in good standing.",
      links: [{ label: "Open Material Ledger", href: "/admin" }],
      intent: "portfolio-expiry-clear",
    };
  }

  return {
    answer:
      `Certificate status across the portfolio: ${summary.expiredCount} expired, ${summary.expiringUrgentCount} expiring urgently, ` +
      `${summary.expiringSoonCount} expiring soon (${summary.unacknowledgedCount} unacknowledged). ` +
      `Thresholds: urgent within the next few days, soon within ${summary.thresholds.expiringSoonDays} days.`,
    links: [{ label: "Open Material Ledger", href: "/admin" }],
    intent: "portfolio-expiry",
  };
}

// ---------------------------------------------------------------------
// Intent 6 — navigation help
// ---------------------------------------------------------------------

interface NavEntry {
  href: string;
  label: string;
  keywords: string[];
}

const NAV_INDEX: NavEntry[] = [
  { href: "/admin", label: "Material Ledger", keywords: ["ledger", "material ledger", "batch list", "passports list", "issue a passport", "create a batch"] },
  { href: "/admin/suppliers", label: "Supplier Rankings", keywords: ["supplier ranking", "supplier performance", "vendor ranking", "supplier dashboard"] },
  { href: "/admin/search", label: "Global Search", keywords: ["search", "find a batch", "command palette", "filter"] },
  { href: "/admin/audit", label: "Audit Trail", keywords: ["audit log", "audit trail", "ledger log", "history", "who changed"] },
  { href: "/admin/esg-analytics", label: "ESG Analytics", keywords: ["esg", "carbon analytics", "sustainability dashboard", "regulatory compliance"] },
  { href: "/admin/green-accounting", label: "Green Accounting", keywords: ["green tax", "green accounting", "tax export", "plastic tax"] },
  { href: "/admin/generator", label: "QR & Label Generator", keywords: ["qr code", "label sheet", "generator suite", "print labels"] },
  { href: "/admin/notifications", label: "Notifications & Webhooks", keywords: ["notification", "webhook", "alert settings", "email settings"] },
];

const NAV_TRIGGER_KEYWORDS = ["where", "how do i find", "how do i get to", "navigate", "which page", "what page"];

async function tryNavigationHelp(question: string): Promise<AssistantAnswer | null> {
  const looksLikeNavQuestion = NAV_TRIGGER_KEYWORDS.some((kw) => question.includes(kw));
  if (!looksLikeNavQuestion) return null;

  const match = NAV_INDEX.find((entry) => entry.keywords.some((kw) => question.includes(kw)));
  if (!match) {
    return {
      answer: "I couldn't tell which page you're looking for. Try Global Search (Cmd/Ctrl+K from anywhere in the admin console) — it covers batches, certificates, suppliers, and the audit log in one place.",
      links: [{ label: "Open Global Search", href: "/admin/search" }],
      intent: "navigation-unmatched",
    };
  }

  return {
    answer: `That's the ${match.label} page.`,
    links: [{ label: `Open ${match.label}`, href: match.href }],
    intent: "navigation",
  };
}

// ---------------------------------------------------------------------
// Intent 7 — greeting / capability list
// ---------------------------------------------------------------------

const GREETING_PATTERN = /^(hi|hello|hey|help|what can you do|what do you do)\b/i;

function tryGreeting(question: string): AssistantAnswer | null {
  if (!GREETING_PATTERN.test(question.trim())) return null;
  return {
    answer:
      "I can look up a specific batch (\"status of BATCH-2026-EU-014\"), summarize the portfolio (\"how many batches do we have\"), " +
      "check certificate expirations (\"any certificates expiring soon\"), rank suppliers (\"top supplier by performance\"), " +
      "explain a compliance term (\"what is ISCC PLUS\", \"what does PCR mean\"), or point you to a page (\"where do I find the audit log\").",
    links: [{ label: "Open Global Search", href: "/admin/search" }],
    intent: "greeting",
  };
}

// ---------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------

const FALLBACK_ANSWER: AssistantAnswer = {
  answer:
    "I couldn't find a specific match for that. Try asking about a batch (\"status of BATCH-2026-EU-014\"), certificate expirations, " +
    "supplier performance, a compliance term (ISCC PLUS, PCR, ESPR, mass balance...), or say \"help\" to see everything I can answer. " +
    "For anything broader, Global Search covers batches, certificates, suppliers, and the audit log at once.",
  links: [{ label: "Open Global Search", href: "/admin/search" }],
  intent: "fallback",
};

export async function answerAssistantQuestion(rawQuestion: string): Promise<AssistantAnswer> {
  const question = rawQuestion.trim().slice(0, MAX_QUESTION_LENGTH);
  if (!question) {
    return {
      answer: "Ask me about a batch, certificate expirations, supplier performance, a compliance term, or where to find something in the admin console.",
      links: [],
      intent: "empty",
    };
  }

  const normalized = question.toLowerCase();

  const greeting = tryGreeting(question);
  if (greeting) return greeting;

  const batchAnswer = await tryBatchLookup(question);
  if (batchAnswer) return batchAnswer;

  const portfolioCount = await tryPortfolioCount(normalized);
  if (portfolioCount) return portfolioCount;

  const glossaryAnswer = await tryGlossary(question);
  if (glossaryAnswer) return glossaryAnswer;

  const supplierAnswer = await trySupplierRanking(normalized);
  if (supplierAnswer) return supplierAnswer;

  const expiryAnswer = await tryPortfolioExpiry(normalized);
  if (expiryAnswer) return expiryAnswer;

  const navAnswer = await tryNavigationHelp(normalized);
  if (navAnswer) return navAnswer;

  return FALLBACK_ANSWER;
}

// ---------------------------------------------------------------------
// Public orchestrator — components/PublicScanPage.tsx
// ---------------------------------------------------------------------
//
// See this file's own banner for why this is a separate function rather
// than answerAssistantQuestion() plus a scope flag: everything below is
// the ENTIRE set of intents reachable from the public entry point —
// portfolio count, supplier ranking, portfolio-wide expiry, and admin
// navigation are simply never referenced here, so there is no path to
// them regardless of how this function is invoked.

function tryGreetingPublic(question: string): AssistantAnswer | null {
  if (!GREETING_PATTERN.test(question.trim())) return null;
  return {
    answer:
      "I can tell you about this product's batch — its status, material grade, recycled content, manufacturer, and certifications — " +
      "or explain a compliance term (\"what is ISCC PLUS\", \"what does PCR mean\", \"what is mass balance\"). Ask away.",
    links: [],
    intent: "greeting",
  };
}

const FALLBACK_ANSWER_PUBLIC: AssistantAnswer = {
  answer:
    "I couldn't find a specific match for that. Try asking about this batch's status, material, or certifications, or a compliance " +
    "term like ISCC PLUS, PCR, ESPR, or mass balance. Say \"help\" to see what I can answer.",
  links: [],
  intent: "fallback",
};

export async function answerPublicAssistantQuestion(rawQuestion: string, contextBatchId?: string): Promise<AssistantAnswer> {
  const question = rawQuestion.trim().slice(0, MAX_QUESTION_LENGTH);
  if (!question) {
    return {
      answer: "Ask me about this batch's status, material, recycled content, or certifications, or a compliance term like ISCC PLUS or PCR.",
      links: [],
      intent: "empty",
    };
  }

  const greeting = tryGreetingPublic(question);
  if (greeting) return greeting;

  const batchAnswer = await tryBatchLookup(question, { contextBatchId, publicMode: true });
  if (batchAnswer) return batchAnswer;

  const glossaryAnswer = await tryGlossary(question, true);
  if (glossaryAnswer) return glossaryAnswer;

  return FALLBACK_ANSWER_PUBLIC;
}
