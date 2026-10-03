// AES-256-GCM encryption for Executive info secrets. Server only.
// Never log keys, plaintext, or ciphertext.
//
// Key rotation is NOT supported yet: every stored value is base64(iv || ciphertext+tag)
// under the single EXEC_INFO_ENCRYPTION_KEY, with no key id. Changing the key makes
// existing values unreadable until a re-encryption migration is written.

const GENERIC = "Executive info encryption is unavailable";

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

async function getKey(): Promise<CryptoKey> {
  const raw = process.env["EXEC_INFO_ENCRYPTION_KEY"];
  if (!raw) throw new Error(GENERIC);
  let bytes: Uint8Array;
  try {
    bytes = b64ToBytes(raw.trim());
  } catch {
    throw new Error(GENERIC);
  }
  if (bytes.length !== 32) throw new Error(GENERIC);
  return crypto.subtle.importKey("raw", bytes as BufferSource, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptSecret(plain: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return bytesToB64(out);
}

export async function decryptSecret(stored: string): Promise<string> {
  const key = await getKey();
  try {
    const all = b64ToBytes(stored);
    const iv = all.slice(0, 12);
    const ct = all.slice(12);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error("Could not read this value");
  }
}
