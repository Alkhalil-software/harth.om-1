const crypto = require("crypto");

/**
 * Generate a human-readable tracking number like "HRT-K8N2P9X4".
 * Uses Crockford's alphabet (no 0/O/1/I/L) to avoid transcription errors.
 *
 * 8 characters from a 31-char alphabet = 31^8 ≈ 850 billion possibilities.
 * Collision probability at even 100k orders is ~ 10^-5 — the unique constraint
 * in the DB will catch the rare clash and the caller can retry.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function generateTrackingNumber() {
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return `HRT-${code}`;
}

function generateRentalTrackingNumber() {
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return `IJ-${code}`;
}

module.exports = { generateTrackingNumber, generateRentalTrackingNumber };
