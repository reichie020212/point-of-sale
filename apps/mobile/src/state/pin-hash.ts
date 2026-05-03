/**
 * PIN hash — deliberately small, deterministic, dependency-free.
 *
 * Threat model: a 4-digit PIN has 10 000 possibilities. Any
 * cryptographic hash (SHA-256, bcrypt, etc.) is brute-forceable in
 * milliseconds against that space. The hash here exists for one
 * reason: keep PINs out of plaintext storage in the DB / backups /
 * logs. Salt is the user's UUID, which differs per user, so two
 * cashiers with PIN "1234" produce different hashes.
 *
 * Algorithm: FNV-1a (32-bit), output as 8-char zero-padded hex.
 * The same algorithm runs on the API server and on the mobile
 * client so PINs validate offline. Keep this file byte-identical
 * with `apps/api/src/auth/pin-hash.ts`.
 */
export function hashPin(userId: string, pin: string): string {
  const input = `${userId}:${pin}`;
  let h = 0x811c9dc5; // FNV offset basis (32-bit)
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // FNV prime 0x01000193 multiplication, kept inside 32 bits.
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** True iff the candidate PIN matches the stored hash for this user. */
export function verifyPin(userId: string, pin: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  // Constant-time-ish compare: compare every char even after a
  // mismatch. 8 chars is short enough that timing-side-channel
  // concern is theatrical, but cheap to be defensive.
  const candidate = hashPin(userId, pin);
  if (candidate.length !== storedHash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < candidate.length; i++) {
    mismatch |= candidate.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return mismatch === 0;
}

/** PIN must be exactly 4 digits (0–9). */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
