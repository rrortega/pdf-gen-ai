import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * scrypt cost parameters (RFC 7914 recommended baseline). They are embedded in
 * the stored string so a future cost increase can still verify old hashes.
 */
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const KEY_LENGTH = 64;

function format(stored: {
  cost: number;
  blockSize: number;
  parallelization: number;
  salt: Buffer;
  derivedKey: Buffer;
}): string {
  return [
    "scrypt",
    stored.cost,
    stored.blockSize,
    stored.parallelization,
    stored.salt.toString("base64"),
    stored.derivedKey.toString("base64"),
  ].join("$");
}

function parse(stored: string):
  | { cost: number; blockSize: number; parallelization: number; salt: Buffer; derivedKey: Buffer }
  | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return null;
  }

  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallelization = Number(parts[3]);

  if (!Number.isFinite(cost) || !Number.isFinite(blockSize) || !Number.isFinite(parallelization)) {
    return null;
  }

  try {
    const salt = Buffer.from(parts[4], "base64");
    const derivedKey = Buffer.from(parts[5], "base64");
    if (salt.length === 0 || derivedKey.length === 0) {
      return null;
    }
    return { cost, blockSize, parallelization, salt, derivedKey };
  } catch {
    return null;
  }
}

/**
 * Hashes a password with scrypt (node:crypto, no new dependency). The result
 * is a strong one-way string: random salt per hash, parameters embedded,
 * plaintext never stored or logged.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH);
  return format({
    cost: SCRYPT_COST,
    blockSize: SCRYPT_BLOCK_SIZE,
    parallelization: SCRYPT_PARALLELIZATION,
    salt,
    derivedKey,
  });
}

/**
 * Constant-time password verification. Any malformed or foreign-format stored
 * value answers false instead of throwing.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parse(stored);
  if (!parsed) {
    return false;
  }

  let candidate: Buffer;
  try {
    candidate = await scrypt(password, parsed.salt, parsed.derivedKey.length);
  } catch {
    return false;
  }

  if (candidate.length !== parsed.derivedKey.length) {
    return false;
  }
  return timingSafeEqual(candidate, parsed.derivedKey);
}
