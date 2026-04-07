/** Simple password hashing for player authentication.
 *  Uses SHA-256 with a per-player salt. */

import { createHash, randomBytes } from 'crypto';

/** Hash a password with a random salt. Returns "salt:hash" */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(salt + password).digest('hex');
  return `${salt}:${hash}`;
}

/** Verify a password against a stored "salt:hash" string */
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || !stored.includes(':')) return false;
  const [salt, expectedHash] = stored.split(':');
  const hash = createHash('sha256').update(salt + password).digest('hex');
  return hash === expectedHash;
}
