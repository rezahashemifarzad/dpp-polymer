/**
 * lib/password.ts
 * -----------------------------------------------------------------------
 * Password hashing for the Role-Based Authentication & Client/Auditor
 * Portal Suite's credential-based login (Auditor.passwordHash /
 * Client.passwordHash — see prisma/schema.prisma's own comments on those
 * fields).
 *
 * Uses Node's built-in `crypto.scrypt` — no new npm dependency, consistent
 * with this codebase's existing (and only) crypto primitive, already used
 * for SHA-256 hashing in lib/auditor-auth.ts, lib/client-auth.ts, and
 * lib/types.ts's hashRecord.
 *
 * DELIBERATELY NOT the same algorithm as apiKeyHash/tokenHash elsewhere in
 * this schema. Those hash a 256-bit, uniformly-random, server-generated
 * token — a plain SHA-256 digest is fine there because the input already
 * has all the entropy an attacker would need to search through. A
 * human-chosen password has nowhere near that entropy, so it needs a
 * memory-hard, deliberately-slow KDF (scrypt) to resist offline brute
 * force. Reusing hashRecord()/SHA-256 for passwords would be a real
 * security regression, not just a style inconsistency — keep these two
 * hashing paths distinct.
 *
 * Encoded format: `scrypt:<N>:<r>:<p>:<saltHex>:<hashHex>` — self-describing
 * so the cost parameters can be bumped later (e.g. after a hardware
 * upgrade) without invalidating already-stored hashes or needing a schema
 * migration; verifyPassword() always re-derives using the parameters
 * embedded in the stored string, not today's constants.
 */

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";

/**
 * Promise wrapper around Node's callback-style crypto.scrypt, written by
 * hand rather than via util.promisify(scryptCallback) — util.promisify's
 * TypeScript typings only resolve against the LAST overload of an
 * overloaded function, and crypto.scrypt's last declared overload is the
 * no-options 4-arg form (password, salt, keylen, callback). Wrapping the
 * 5-arg options-taking overload ourselves is what actually lets N/r/p be
 * passed through with correct types.
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

// Cost parameters for NEW hashes. Memory cost is roughly 128 * N * r bytes
// (~16.8MB at these settings) — comfortably under Node's default 32MB
// scrypt maxmem, so no custom maxmem option is needed.
const SCRYPT_N = 16384; // 2^14
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

const ENCODING_PREFIX = "scrypt";

async function deriveKey(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return scryptAsync(password.normalize("NFKC"), salt, KEY_LEN, { N, r, p });
}

/**
 * Hashes a raw password into the self-describing encoded string above.
 * Always uses today's SCRYPT_N/R/P — only verifyPassword() needs to handle
 * older parameter sets it might encounter in already-stored hashes.
 */
export async function hashPassword(rawPassword: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const derived = await deriveKey(rawPassword, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return `${ENCODING_PREFIX}:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString("hex")}:${derived.toString("hex")}`;
}

/**
 * Verifies a raw password against a stored encoded hash. Returns false
 * (never throws) for a malformed/foreign-format hash, so a corrupted or
 * unexpected passwordHash value fails closed rather than crashing the
 * login action.
 */
export async function verifyPassword(rawPassword: string, encoded: string): Promise<boolean> {
  const parts = encoded.split(":");
  if (parts.length !== 6 || parts[0] !== ENCODING_PREFIX) return false;

  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const derived = await deriveKey(rawPassword, salt, N, r, p);
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    // Malformed hex, scrypt parameter rejection, etc. — treat exactly like
    // "wrong password" rather than surfacing an internal error to the
    // login flow.
    return false;
  }
}

/**
 * Runs a scrypt derivation of equivalent cost to a real verification, but
 * against a constant dummy input, and discards the result. Call this on
 * the "no such account" branch of a login flow so that response latency
 * cannot be used to distinguish "unknown email" from "wrong password" —
 * without it, the missing scrypt call on the not-found path would make
 * that branch measurably faster.
 */
export async function dummyVerifyDelay(): Promise<void> {
  await deriveKey("dummy-password-for-constant-time-padding", Buffer.alloc(SALT_LEN, 0), SCRYPT_N, SCRYPT_R, SCRYPT_P);
}
