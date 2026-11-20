import { createHash, randomBytes } from "node:crypto";

/**
 * Generates an opaque, high-entropy secret (session secret, API key, reset
 * token, OAuth code). Plaintext exists only at issue time.
 */
export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Strong one-way lookup key for opaque secrets. Verification hashes the
 * presented secret and looks the hash up through a unique index, so a
 * database leak exposes no usable credentials.
 */
export function hashTokenSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}
