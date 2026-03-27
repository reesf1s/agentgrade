const ENCRYPTED_PREFIX = "enc:";

let hasWarnedAboutEncryptionKey = false;

async function getKeyMaterial() {
  const rawKey =
    process.env.AGENTGRADE_ENCRYPTION_KEY ||
    process.env.CLERK_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rawKey) {
    if (!hasWarnedAboutEncryptionKey) {
      hasWarnedAboutEncryptionKey = true;
      console.warn("[secrets] No encryption key configured. Sensitive values will be stored in plaintext.");
    }
    return null;
  }

  const encoded = new TextEncoder().encode(rawKey);
  const digest = await crypto.subtle.digest("SHA-256", encoded);

  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

function concatBytes(left: Uint8Array, right: Uint8Array) {
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left, 0);
  combined.set(right, left.length);
  return combined;
}

export async function encryptSecret(value: string | null | undefined) {
  if (!value) return null;

  const key = await getKeyMaterial();
  if (!key) return value;
  if (value.startsWith(ENCRYPTED_PREFIX)) return value;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt("AES-GCM", key, new TextEncoder().encode(value))
  );

  return `${ENCRYPTED_PREFIX}${Buffer.from(concatBytes(iv, ciphertext)).toString("base64url")}`;
}

export async function decryptSecret(value: string | null | undefined) {
  if (!value) return null;
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value;

  const key = await getKeyMaterial();
  if (!key) return value;

  const bytes = new Uint8Array(Buffer.from(value.slice(ENCRYPTED_PREFIX.length), "base64url"));
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);

  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}
