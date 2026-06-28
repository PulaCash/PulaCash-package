import { createHash, randomBytes, randomInt, scrypt as scryptCb, type ScryptOptions, timingSafeEqual } from "node:crypto";

// Promise wrapper (explicit, so the options overload is preserved by the types)
// and non-blocking so password hashing never stalls the event loop.
function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

// scrypt is memory-hard and ships with Node, so we get a strong, dependency-free
// password hash. N=2^15 keeps verification well under ~100ms on a server CPU.
const SCRYPT = { N: 32_768, r: 8, p: 1, keylen: 64 } as const;

/**
 * Hash a password into a self-describing `scrypt$N$r$p$salt$hash` string so the
 * parameters travel with the hash and can be tuned later without breaking old
 * rows. A fresh 16-byte salt is generated per password.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: 256 * 1024 * 1024
  })) as Buffer;
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/** Constant-time verification of a password against a stored `scrypt$...` hash. */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex!, "hex");
  const expected = Buffer.from(hashHex!, "hex");
  if (expected.length === 0) return false;
  const derived = (await scrypt(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 256 * 1024 * 1024
  })) as Buffer;
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/**
 * Issue an opaque, unguessable session token (256 bits of entropy). The raw token
 * is returned to the client exactly once; only its SHA-256 hash is ever stored, so
 * a database leak cannot be replayed as a bearer token.
 */
export function issueSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

/** Deterministic SHA-256 of a token, used as the storage/lookup key. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cryptographically-strong 6-digit email-verification code (CSPRNG, not Math.random). */
export function generateVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}
