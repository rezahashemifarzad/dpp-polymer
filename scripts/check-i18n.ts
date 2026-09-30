/**
 * scripts/check-i18n.ts
 * -----------------------------------------------------------------------
 * Translation consistency check for the in-app EN/DE/FR dictionaries.
 *
 *   npx tsx scripts/check-i18n.ts
 *
 * Fails (exit 1) when:
 *   - EN, DE and FR do not contain exactly the same keys
 *     (lib/i18n/app-dictionary.ts + lib/i18n/dashboard-dictionary.ts);
 *   - a translation uses different {placeholders} than its English source;
 *   - a component or page calls t("some.key") with a key that has no
 *     English entry (it would render the raw key).
 *
 * Reads the files as text so it runs standalone, without the Next.js
 * path aliases.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

type Dict = Map<string, string>;

function parseBlocks(file: string): Record<string, Dict> {
  const src = readFileSync(join(ROOT, file), "utf8");
  const blocks: Record<string, Dict> = {};
  const re = /(?:export\s+)?const\s+(\w+)\s*:\s*[\w<>, ]+=\s*\{([\s\S]*?)\n\};/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const dict: Dict = new Map();
    const entry = /"([^"]+)"\s*:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g;
    let e: RegExpExecArray | null;
    while ((e = entry.exec(m[2]))) dict.set(e[1], JSON.parse(`"${e[2]}"`));
    blocks[m[1]] = dict;
  }
  return blocks;
}

const app = parseBlocks("lib/i18n/app-dictionary.ts");
const dash = parseBlocks("lib/i18n/dashboard-dictionary.ts");
const merge = (a?: Dict, b?: Dict): Dict => new Map([...(a ?? []), ...(b ?? [])]);
const dicts: Record<"EN" | "DE" | "FR", Dict> = {
  EN: merge(app.EN, dash.DASHBOARD_EN),
  DE: merge(app.DE, dash.DASHBOARD_DE),
  FR: merge(app.FR, dash.DASHBOARD_FR),
};

const failures: string[] = [];
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join(",");

for (const lang of ["DE", "FR"] as const) {
  for (const key of dicts.EN.keys()) {
    if (!dicts[lang].has(key)) failures.push(`${lang} is missing key ${key}`);
    else if (placeholders(dicts.EN.get(key)!) !== placeholders(dicts[lang].get(key)!))
      failures.push(`${lang} placeholders differ for ${key}`);
  }
  for (const key of dicts[lang].keys()) if (!dicts.EN.has(key)) failures.push(`${lang} has extra key ${key}`);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(full);
  }
  return out;
}

for (const dir of ["components", "app"]) {
  let files: string[] = [];
  try {
    files = walk(join(ROOT, dir));
  } catch {
    continue;
  }
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    // Only files that use the app-wide hook; app/page-level local `t` objects are separate systems.
    if (!src.includes("useLanguage")) continue;
    for (const m of src.matchAll(/\bt\(\s*"([A-Za-z][\w.]*\.[\w.]+)"/g)) {
      if (!dicts.EN.has(m[1])) failures.push(`${file.slice(ROOT.length + 1)} uses unknown key ${m[1]}`);
    }
    for (const m of src.matchAll(/"(ui\.[A-Za-z]+\.[A-Za-z0-9]+)"/g)) {
      if (!dicts.EN.has(m[1])) failures.push(`${file.slice(ROOT.length + 1)} references unknown key ${m[1]}`);
    }
  }
}

if (failures.length) {
  console.error(`i18n check FAILED (${failures.length}):`);
  for (const f of [...new Set(failures)]) console.error("  " + f);
  process.exit(1);
}
console.log(`i18n check passed: ${dicts.EN.size} keys in EN, DE and FR; every referenced key exists.`);
