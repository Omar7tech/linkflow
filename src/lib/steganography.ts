/**
 * Least-significant-bit (LSB) steganography with optional AES-GCM encryption.
 *
 * We hide bytes in the low bit of each R/G/B channel (alpha is left untouched so
 * transparency never shifts). The change is ±1 per channel — invisible to the
 * eye, but only survives *lossless* formats, so output must be PNG. A small
 * header lets the decoder find the payload and know its length:
 *
 *   "FSTG" (4) · flags (1, bit0 = encrypted) · length (4, big-endian) · payload
 *
 * With a passphrase the payload is [salt(16)][iv(12)][AES-GCM ciphertext+tag],
 * so without the key the bits are indistinguishable from noise.
 */

const MAGIC = [0x46, 0x53, 0x54, 0x47]; // "FSTG"
const HEADER_LEN = 9;

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** Usable payload bytes for an image of the given pixel count (3 bits/pixel). */
export function capacityBytes(pixels: number): number {
  return Math.floor((pixels * 3) / 8) - HEADER_LEN;
}

/* -------------------------------- crypto ---------------------------------- */

// The DOM lib types BufferSource as ArrayBuffer-backed; our views are fine at
// runtime, so coerce at the Web Crypto boundary.
const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

async function deriveKey(pass: string, salt: Uint8Array, usage: KeyUsage) {
  const base = await crypto.subtle.importKey(
    "raw",
    bs(new TextEncoder().encode(pass)),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: bs(salt), iterations: 150_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  );
}

async function encrypt(message: string, pass: string): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt, "encrypt");
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: bs(iv) }, key, bs(new TextEncoder().encode(message)))
  );
  return concat(salt, iv, ct);
}

async function decrypt(payload: Uint8Array, pass: string): Promise<string> {
  const salt = payload.slice(0, 16);
  const iv = payload.slice(16, 28);
  const ct = payload.slice(28);
  const key = await deriveKey(pass, salt, "decrypt");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bs(iv) }, key, bs(ct));
  return new TextDecoder().decode(plain);
}

/* ------------------------------ bit packing ------------------------------- */

function buildPacket(payload: Uint8Array, encrypted: boolean): Uint8Array {
  const head = new Uint8Array(HEADER_LEN);
  head.set(MAGIC);
  head[4] = encrypted ? 1 : 0;
  const len = payload.length;
  head[5] = (len >>> 24) & 0xff;
  head[6] = (len >>> 16) & 0xff;
  head[7] = (len >>> 8) & 0xff;
  head[8] = len & 0xff;
  return concat(head, payload);
}

/** Write packet bits into the LSBs of R/G/B channels of `data` (mutates it). */
function writeBits(data: Uint8ClampedArray, packet: Uint8Array) {
  const totalBits = packet.length * 8;
  let bit = 0;
  for (let p = 0; p < data.length && bit < totalBits; p++) {
    if (p % 4 === 3) continue; // skip alpha
    const value = (packet[bit >> 3] >> (7 - (bit & 7))) & 1;
    data[p] = (data[p] & 0xfe) | value;
    bit++;
  }
  if (bit < totalBits) throw new Error("Image too small for this message");
}

function readBytes(data: Uint8ClampedArray, byteLen: number, startBit = 0): Uint8Array {
  const out = new Uint8Array(byteLen);
  const totalBits = byteLen * 8;
  let bit = 0;
  let channel = 0;
  for (let p = 0; p < data.length && bit < totalBits; p++) {
    if (p % 4 === 3) continue;
    if (channel++ < startBit) continue;
    out[bit >> 3] |= (data[p] & 1) << (7 - (bit & 7));
    bit++;
  }
  return out;
}

/* -------------------------------- public ---------------------------------- */

/** Embed a message into image pixels, returning new ImageData (does not mutate input). */
export async function hideMessage(
  source: ImageData,
  message: string,
  passphrase?: string
): Promise<ImageData> {
  const encrypted = !!passphrase;
  const payload = encrypted
    ? await encrypt(message, passphrase!)
    : new TextEncoder().encode(message);
  const packet = buildPacket(payload, encrypted);

  const copy = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
  writeBits(copy.data, packet);
  return copy;
}

export interface Revealed {
  message: string;
  encrypted: boolean;
}

/** Extract a hidden message, decrypting if a passphrase is supplied. */
export async function revealMessage(source: ImageData, passphrase?: string): Promise<Revealed> {
  const header = readBytes(source.data, HEADER_LEN);
  if (!MAGIC.every((b, i) => header[i] === b)) {
    throw new Error("No hidden message found in this image");
  }
  const encrypted = header[4] === 1;
  const len = (header[5] << 24) | (header[6] << 16) | (header[7] << 8) | header[8];
  if (len < 0 || len > capacityBytes((source.data.length / 4) | 0) + HEADER_LEN) {
    throw new Error("This image's hidden data looks corrupted");
  }

  // Read header + payload, then drop the header bytes.
  const full = readBytes(source.data, HEADER_LEN + len);
  const payload = full.slice(HEADER_LEN);

  if (encrypted) {
    if (!passphrase) throw new Error("This message is encrypted — enter the passphrase");
    try {
      return { message: await decrypt(payload, passphrase), encrypted };
    } catch {
      throw new Error("Wrong passphrase, or the image was altered");
    }
  }
  return { message: new TextDecoder().decode(payload), encrypted };
}
