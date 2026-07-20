import * as crypto from 'crypto';

const KEY_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generates a new Access Key pair.
 *
 * - `access_key_id`: `AKIA` + 16 uppercase alphanumeric chars (20 chars total) — public,
 *   stored as-is, used to look up the key.
 * - `secret_key`: 30 random bytes, base64-encoded — shown to the caller once, never stored
 *   in plaintext (see {@link encryptSecret}).
 */
export function generateAccessKeyPair(): {
  access_key_id: string;
  secret_key: string;
} {
  const randomChars = Array.from(crypto.randomBytes(16))
    .map((b) => KEY_ID_CHARS[b % KEY_ID_CHARS.length])
    .join('');

  return {
    access_key_id: `AKIA${randomChars}`,
    secret_key: crypto.randomBytes(30).toString('base64'),
  };
}

/**
 * Encrypts a plaintext secret key with AES-256-GCM.
 * Returns a colon-delimited `iv:authTag:ciphertext` string (all base64) so the
 * whole payload fits in a single `text` column.
 *
 * @param plaintext - The raw secret key.
 * @param masterKey - 32-byte hex string (`ACCESS_KEY_SECRET_ENCRYPTION_KEY`).
 */
export function encryptSecret(plaintext: string, masterKey: string): string {
  const key = Buffer.from(masterKey, 'hex');
  const iv = crypto.randomBytes(12); // 96-bit IV, GCM standard
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypts a secret key previously encrypted with {@link encryptSecret}.
 *
 * @param encryptedPayload - `iv:authTag:ciphertext` (all base64).
 * @param masterKey - 32-byte hex string (`ACCESS_KEY_SECRET_ENCRYPTION_KEY`).
 */
export function decryptSecret(
  encryptedPayload: string,
  masterKey: string,
): string {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret key payload format');
  }

  const [ivB64, authTagB64, ciphertextB64] = parts;
  const key = Buffer.from(masterKey, 'hex');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}
