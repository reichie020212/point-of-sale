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
 * with `apps/mobile/src/state/pin-hash.ts`.
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

/** PIN must be exactly 4 digits (0–9). */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
