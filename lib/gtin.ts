/**
 * lib/gtin.ts
 * -----------------------------------------------------------------------
 * Pure GS1 GTIN-14 helpers with zero server-only dependencies (no Node
 * `crypto`, no `@prisma/client`) — safe to import from client components.
 * lib/types.ts re-uses `isValidGtin14` for the server-side Zod schema;
 * client forms (e.g. CreatePassportModal) import directly from here for
 * live validation without pulling server-only code into the browser bundle.
 */

export function gtinCheckDigit(first13Digits: string): number {
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const digit = Number(first13Digits[i]);
    // Rightmost data digit (i = 12) carries weight 3, alternating leftward.
    const weight = (12 - i) % 2 === 0 ? 3 : 1;
    sum += digit * weight;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin14(gtin: string): boolean {
  if (!/^\d{14}$/.test(gtin)) return false;
  return gtinCheckDigit(gtin.slice(0, 13)) === Number(gtin[13]);
}

/**
 * Builds a valid 14-digit GTIN from a 13-digit prefix, appending the
 * correct GS1 mod-10 check digit. If `first13` isn't exactly 13 digits, a
 * random 13-digit prefix is generated instead. This is a convenience
 * generator for test/demo data entry only — never use it for real,
 * registered GTINs, which must come from GS1.
 */
export function generateValidGtin(first13?: string): string {
  const prefix =
    first13 && /^\d{13}$/.test(first13)
      ? first13
      : Array.from({ length: 13 }, () => Math.floor(Math.random() * 10)).join("");
  return `${prefix}${gtinCheckDigit(prefix)}`;
}
