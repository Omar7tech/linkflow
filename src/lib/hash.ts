/** Hashing utilities — SHA via Web Crypto, MD5/CRC32 implemented below. */

export type HashAlgorithm = "MD5" | "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512" | "CRC32";

export const ALGORITHMS: HashAlgorithm[] = ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512", "CRC32"];

/** Algorithms Web Crypto can key — the only ones available in HMAC mode. */
export const HMAC_ALGORITHMS: HashAlgorithm[] = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

export async function hashBytes(algo: HashAlgorithm, data: Uint8Array): Promise<Uint8Array> {
  switch (algo) {
    case "MD5":
      return md5(data);
    case "CRC32":
      return crc32(data);
    default:
      return new Uint8Array(await crypto.subtle.digest(algo, data as BufferSource));
  }
}

export async function hmacBytes(
  algo: HashAlgorithm,
  key: string,
  data: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: algo },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, data as BufferSource));
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/* ---------------------------------- CRC32 --------------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): Uint8Array {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  crc = (crc ^ 0xffffffff) >>> 0;
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, crc, false);
  return out;
}

/* ----------------------------------- MD5 ---------------------------------- */
/* Reference implementation of RFC 1321 — fine for checksums, not for security. */

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const MD5_K = (() => {
  const k = new Uint32Array(64);
  for (let i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);
  return k;
})();

function rotl(x: number, n: number): number {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

function md5(input: Uint8Array): Uint8Array {
  const bitLen = input.length * 8;
  const paddedLen = (((input.length + 8) >> 6) + 1) << 6;
  const buf = new Uint8Array(paddedLen);
  buf.set(input);
  buf[input.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(paddedLen - 8, bitLen >>> 0, true);
  view.setUint32(paddedLen - 4, Math.floor(bitLen / 0x100000000), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const m = new Uint32Array(16);
  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) m[i] = view.getUint32(offset + i * 4, true);

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      const temp = d;
      d = c;
      c = b;
      b = (b + rotl((a + f + MD5_K[i] + m[g]) >>> 0, MD5_S[i])) >>> 0;
      a = temp;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);
  return out;
}
