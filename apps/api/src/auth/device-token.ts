/**
 * Device token + pairing-code helpers.
 *
 * Pairing flow (HANDOFF §3):
 *   1. An admin clicks "Pair new device" on the web /registers screen.
 *   2. Server generates a 12-char pairing code (CNTR-XXXX-XXXX) and a
 *      `pending`-status placeholder device row with the code +
 *      5-minute TTL.
 *   3. Operator types the code into the unpaired mobile app.
 *   4. Mobile POSTs `/api/v1/devices/pair` with the code; server
 *      mints an opaque device token (`dvc_<32 base64url>`), stores
 *      its SHA-256 hash on the device row, clears the pairing fields,
 *      and flips status to `live`.
 *   5. Mobile sends the token as Bearer on every subsequent request.
 *
 * The token is opaque — no JWT — so there is no signing key to manage
 * and revocation is just clearing the hash. The hash is the only
 * server-side artifact; the plaintext is shown once, then forgotten.
 */
import { createHash, randomBytes } from 'node:crypto';

/** Token prefix used by the auth middleware to dispatch to the
 *  device-token branch. Distinct from anything Clerk emits. */
export const DEVICE_TOKEN_PREFIX = 'dvc_';

/** Pairing code window. HANDOFF §3 specifies 5 minutes. */
export const PAIRING_CODE_TTL_MS = 5 * 60 * 1000;

/**
 * Pairing-code alphabet — no 0/O/I/1 to avoid hand-typing ambiguity.
 * Length 12 (CNTR-XXXX-XXXX) gives ~6e10 possibilities per active
 * window; collisions inside a 5-minute TTL are vanishingly unlikely
 * but the route still retries on unique-violation just in case.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePairingCode(): string {
  const bytes = randomBytes(8);
  let out = 'CNTR-';
  for (let i = 0; i < 8; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
    if (i === 3) out += '-';
  }
  return out;
}

export function generateDeviceToken(): string {
  return DEVICE_TOKEN_PREFIX + randomBytes(24).toString('base64url');
}

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isDeviceToken(token: string): boolean {
  return token.startsWith(DEVICE_TOKEN_PREFIX);
}
