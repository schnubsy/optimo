// AES-GCM for the iCloud app-specific password (ARC.md RULE: the password never reaches the client store or logs).
// Key = PLANNER_KEK, a 32-byte base64 secret. Stored form = base64(iv[12] | ciphertext+tag). Web Crypto only, so this
// runs unchanged in Deno (Edge Functions) and Node (tests).

const b64 = {
  enc: (u: Uint8Array) => btoa(String.fromCharCode(...u)),
  dec: (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
}

export async function importKek(kekB64: string): Promise<CryptoKey> {
  const raw = b64.dec(kekB64)
  if (raw.length !== 32) throw new Error('PLANNER_KEK must be 32 bytes (base64)')
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptSecret(plain: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain)))
  const out = new Uint8Array(iv.length + ct.length)
  out.set(iv)
  out.set(ct, iv.length)
  return b64.enc(out)
}

export async function decryptSecret(stored: string, key: CryptoKey): Promise<string> {
  const all = b64.dec(stored)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, key, all.slice(12))
  return new TextDecoder().decode(pt)
}
