/**
 * A small TrueType writer: glyph outlines in, an installable .ttf out.
 *
 * Writes the tables a font needs to install on Windows and macOS and to load
 * in a browser (whose sanitiser is the strictest check there is): head, hhea,
 * maxp, OS/2, name, cmap, post, glyf, loca and hmtx. Two optional extras:
 * a classic `kern` table for pair kerning, and a GSUB `calt` feature that
 * swaps a letter for its second version when it follows itself, so doubled
 * letters never look copy-pasted.
 */

export interface Pt {
  x: number;
  y: number;
  /** On-curve point; off-curve points are quadratic control points. */
  on: boolean;
}

export type Contour = Pt[];

export interface FontGlyph {
  unicode?: number;
  advance: number;
  contours: Contour[];
}

export interface FontSpec {
  family: string;
  /** Glyph 0 must be .notdef. */
  glyphs: FontGlyph[];
  /** [left glyph, right glyph, adjustment]. */
  kerning?: [number, number, number][];
  /** [base glyph, alternate glyph]. */
  alternates?: [number, number][];
  /** Degrees, positive leans right. */
  slant?: number;
  metrics: { ascender: number; descender: number; capHeight: number; xHeight: number; unitsPerEm: number };
}

/* ------------------------------------------------------------------ bytes */

class Bytes {
  private buf = new Uint8Array(256);
  length = 0;

  private ensure(extra: number) {
    if (this.length + extra <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.length + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.length));
    this.buf = next;
  }

  u8(v: number) {
    this.ensure(1);
    this.buf[this.length++] = v & 0xff;
    return this;
  }
  u16(v: number) {
    return this.u8(v >> 8).u8(v);
  }
  i16(v: number) {
    return this.u16(v < 0 ? v + 0x10000 : v);
  }
  u32(v: number) {
    return this.u16(Math.floor(v / 0x10000) & 0xffff).u16(v & 0xffff);
  }
  i32(v: number) {
    return this.u32(v < 0 ? v + 0x100000000 : v);
  }
  tag(t: string) {
    for (let i = 0; i < 4; i++) this.u8(t.charCodeAt(i) || 32);
    return this;
  }
  bytes(data: Uint8Array) {
    this.ensure(data.length);
    this.buf.set(data, this.length);
    this.length += data.length;
    return this;
  }
  pad4() {
    while (this.length % 4) this.u8(0);
    return this;
  }
  out() {
    return this.buf.slice(0, this.length);
  }
}

const clampI16 = (v: number) => Math.max(-32768, Math.min(32767, Math.round(v)));

function checksum(data: Uint8Array) {
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const word =
      ((data[i] ?? 0) << 24) | ((data[i + 1] ?? 0) << 16) | ((data[i + 2] ?? 0) << 8) | (data[i + 3] ?? 0);
    sum = (sum + (word >>> 0)) >>> 0;
  }
  return sum;
}

function binarySearchFields(count: number, unit: number) {
  let power = 1;
  let log = 0;
  while (power * 2 <= count) {
    power *= 2;
    log++;
  }
  return { searchRange: power * unit, entrySelector: log, rangeShift: count * unit - power * unit };
}

/* ----------------------------------------------------------------- glyphs */

interface Encoded {
  data: Uint8Array;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  points: number;
  contours: number;
}

function encodeGlyph(glyph: FontGlyph): Encoded {
  const contours = glyph.contours.filter((c) => c.length >= 3);
  if (!contours.length) return { data: new Uint8Array(0), xMin: 0, yMin: 0, xMax: 0, yMax: 0, points: 0, contours: 0 };

  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  for (const c of contours)
    for (const p of c) {
      xMin = Math.min(xMin, p.x);
      yMin = Math.min(yMin, p.y);
      xMax = Math.max(xMax, p.x);
      yMax = Math.max(yMax, p.y);
    }

  const b = new Bytes();
  b.i16(contours.length).i16(xMin).i16(yMin).i16(xMax).i16(yMax);
  let end = -1;
  for (const c of contours) {
    end += c.length;
    b.u16(end);
  }
  b.u16(0); // no instructions
  const all = contours.flat();
  for (const p of all) b.u8(p.on ? 1 : 0);
  let last = 0;
  for (const p of all) {
    b.i16(p.x - last);
    last = p.x;
  }
  last = 0;
  for (const p of all) {
    b.i16(p.y - last);
    last = p.y;
  }
  b.pad4();
  return { data: b.out(), xMin, yMin, xMax, yMax, points: all.length, contours: contours.length };
}

/* ----------------------------------------------------------------- tables */

function nameTable(family: string) {
  const postscript = family.replace(/[^A-Za-z0-9-]/g, "").slice(0, 63) || "MyFont";
  const records: [number, string][] = [
    [1, family],
    [2, "Regular"],
    [3, `${postscript}-Regular;${new Date().toISOString().slice(0, 10)}`],
    [4, family],
    [5, "Version 1.000"],
    [6, `${postscript}-Regular`],
    [11, "https://tools.twomindsengine.com"],
  ];
  const strings = records.map(([, text]) => {
    const out = new Uint8Array(text.length * 2);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      out[i * 2] = code >> 8;
      out[i * 2 + 1] = code & 0xff;
    }
    return out;
  });
  const b = new Bytes();
  b.u16(0).u16(records.length).u16(6 + records.length * 12);
  let offset = 0;
  records.forEach(([id], i) => {
    b.u16(3).u16(1).u16(0x0409).u16(id).u16(strings[i].length).u16(offset);
    offset += strings[i].length;
  });
  strings.forEach((s) => b.bytes(s));
  return b.out();
}

function cmapTable(map: [number, number][]) {
  const pairs = [...map].sort((a, b) => a[0] - b[0]);
  const segCount = pairs.length + 1;
  const { searchRange, entrySelector, rangeShift } = binarySearchFields(segCount, 2);
  const sub = new Bytes();
  const length = 16 + segCount * 8;
  sub.u16(4).u16(length).u16(0).u16(segCount * 2).u16(searchRange).u16(entrySelector).u16(rangeShift);
  pairs.forEach(([code]) => sub.u16(code));
  sub.u16(0xffff);
  sub.u16(0);
  pairs.forEach(([code]) => sub.u16(code));
  sub.u16(0xffff);
  pairs.forEach(([code, gid]) => sub.u16((gid - code + 0x10000) % 0x10000));
  sub.u16(1);
  for (let i = 0; i < segCount; i++) sub.u16(0);

  const b = new Bytes();
  b.u16(0).u16(2);
  b.u16(0).u16(3).u32(20);
  b.u16(3).u16(1).u32(20);
  b.bytes(sub.out());
  return b.out();
}

function kernTable(pairs: [number, number, number][]) {
  const sorted = [...pairs].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const { searchRange, entrySelector, rangeShift } = binarySearchFields(sorted.length, 6);
  const b = new Bytes();
  b.u16(0).u16(1);
  b.u16(0).u16(14 + sorted.length * 6).u16(0x0001);
  b.u16(sorted.length).u16(searchRange).u16(entrySelector).u16(rangeShift);
  sorted.forEach(([l, r, v]) => b.u16(l).u16(r).i16(v));
  return b.out();
}

function coverage(glyphs: number[]) {
  const b = new Bytes();
  b.u16(1).u16(glyphs.length);
  glyphs.forEach((g) => b.u16(g));
  return b.out();
}

/** GSUB with one feature, `calt`: a letter that follows itself becomes its alternate. */
function gsubTable(alternates: [number, number][]) {
  const sorted = [...alternates].sort((a, b) => a[0] - b[0]);

  // Lookup 0: single substitution base → alternate. Only reached through lookup 1.
  const single = new Bytes();
  single.u16(2).u16(6 + sorted.length * 2).u16(sorted.length);
  sorted.forEach(([, alt]) => single.u16(alt));
  single.bytes(coverage(sorted.map(([base]) => base)));
  const lookup0 = new Bytes().u16(1).u16(0).u16(1).u16(8).bytes(single.out());

  // Lookup 1: chained context, one subtable per letter: "after X, X → lookup 0".
  const subtables = sorted.map(([base]) => {
    const s = new Bytes();
    s.u16(3).u16(1).u16(18).u16(1).u16(18).u16(0).u16(1).u16(0).u16(0);
    s.bytes(coverage([base]));
    return s.out();
  });
  const lookup1 = new Bytes().u16(6).u16(0).u16(subtables.length);
  let offset = 6 + subtables.length * 2;
  subtables.forEach((s) => {
    lookup1.u16(offset);
    offset += s.length;
  });
  subtables.forEach((s) => lookup1.bytes(s));

  const l0 = lookup0.out();
  const l1 = lookup1.out();
  const lookupList = new Bytes().u16(2).u16(6).u16(6 + l0.length).bytes(l0).bytes(l1).out();

  const featureList = new Bytes().u16(1).tag("calt").u16(8).u16(0).u16(1).u16(1).out();

  const langSys = () => new Bytes().u16(0).u16(0xffff).u16(1).u16(0).out();
  const script = () => new Bytes().u16(4).u16(0).bytes(langSys()).out();
  const scriptList = new Bytes()
    .u16(2)
    .tag("DFLT")
    .u16(14)
    .tag("latn")
    .u16(26)
    .bytes(script())
    .bytes(script())
    .out();

  return new Bytes()
    .u16(1)
    .u16(0)
    .u16(10)
    .u16(10 + scriptList.length)
    .u16(10 + scriptList.length + featureList.length)
    .bytes(scriptList)
    .bytes(featureList)
    .bytes(lookupList)
    .out();
}

/* ------------------------------------------------------------------ build */

export function buildTtf(spec: FontSpec): Uint8Array {
  const { glyphs, metrics } = spec;
  const encoded = glyphs.map(encodeGlyph);
  const inked = encoded.filter((e) => e.contours);

  const xMin = Math.min(0, ...inked.map((e) => e.xMin));
  const yMin = Math.min(metrics.descender, ...inked.map((e) => e.yMin));
  const xMax = Math.max(0, ...inked.map((e) => e.xMax));
  const yMax = Math.max(metrics.ascender, ...inked.map((e) => e.yMax));

  const lsbs = encoded.map((e) => (e.contours ? e.xMin : 0));
  const advances = glyphs.map((g) => Math.max(0, Math.round(g.advance)));
  const slant = spec.slant ?? 0;

  // glyf + loca
  const glyf = new Bytes();
  const loca = new Bytes();
  for (const e of encoded) {
    loca.u32(glyf.length);
    glyf.bytes(e.data);
  }
  loca.u32(glyf.length);

  // head
  const seconds = Math.floor(Date.now() / 1000) + 2082844800;
  const head = new Bytes()
    .u32(0x00010000)
    .u32(0x00010000)
    .u32(0)
    .u32(0x5f0f3cf5)
    .u16(0x000b)
    .u16(metrics.unitsPerEm)
    .u32(Math.floor(seconds / 0x100000000))
    .u32(seconds >>> 0)
    .u32(Math.floor(seconds / 0x100000000))
    .u32(seconds >>> 0)
    .i16(xMin)
    .i16(yMin)
    .i16(xMax)
    .i16(yMax)
    .u16(0)
    .u16(8)
    .i16(2)
    .i16(1)
    .i16(0)
    .out();

  // hhea
  const rsbs = encoded.map((e, i) => (e.contours ? advances[i] - e.xMax : advances[i]));
  const extents = encoded.map((e, i) => (e.contours ? lsbs[i] + (e.xMax - e.xMin) : 0));
  const hhea = new Bytes()
    .u32(0x00010000)
    .i16(yMax)
    .i16(yMin)
    .i16(0)
    .u16(Math.max(...advances))
    .i16(Math.min(...lsbs))
    .i16(clampI16(Math.min(...rsbs)))
    .i16(Math.max(...extents))
    .i16(1000)
    .i16(Math.round(Math.tan((slant * Math.PI) / 180) * 1000))
    .i16(0)
    .i16(0)
    .i16(0)
    .i16(0)
    .i16(0)
    .i16(0)
    .u16(glyphs.length)
    .out();

  // maxp
  const maxp = new Bytes()
    .u32(0x00010000)
    .u16(glyphs.length)
    .u16(Math.max(0, ...encoded.map((e) => e.points)))
    .u16(Math.max(0, ...encoded.map((e) => e.contours)))
    .u16(0)
    .u16(0)
    .u16(2)
    .u16(0)
    .u16(0)
    .u16(0)
    .u16(0)
    .u16(0)
    .u16(0)
    .u16(0)
    .u16(0)
    .out();

  // OS/2 (version 4)
  const codes = glyphs.map((g) => g.unicode).filter((u): u is number => u !== undefined);
  const visible = advances.filter((a) => a > 0);
  const os2 = new Bytes()
    .u16(4)
    .i16(Math.round(visible.reduce((s, a) => s + a, 0) / Math.max(1, visible.length)))
    .u16(400)
    .u16(5)
    .u16(0)
    .i16(650)
    .i16(600)
    .i16(0)
    .i16(75)
    .i16(650)
    .i16(600)
    .i16(0)
    .i16(350)
    .i16(50)
    .i16(300)
    .i16(0);
  for (let i = 0; i < 10; i++) os2.u8(0);
  os2
    .u32(1)
    .u32(0)
    .u32(0)
    .u32(0)
    .tag("TMTL")
    .u16(0x0040 | 0x0080)
    .u16(Math.min(...codes))
    .u16(Math.max(...codes))
    .i16(metrics.ascender)
    .i16(metrics.descender)
    .i16(200)
    .u16(Math.max(0, yMax))
    .u16(Math.max(0, -yMin))
    .u32(1)
    .u32(0)
    .i16(metrics.xHeight)
    .i16(metrics.capHeight)
    .u16(0)
    .u16(32)
    .u16(2);

  // post (version 3: no glyph names)
  const post = new Bytes()
    .u32(0x00030000)
    .i32(Math.round(-slant * 65536))
    .i16(-100)
    .i16(50)
    .u32(0)
    .u32(0)
    .u32(0)
    .u32(0)
    .u32(0)
    .out();

  // hmtx
  const hmtx = new Bytes();
  glyphs.forEach((_, i) => hmtx.u16(advances[i]).i16(lsbs[i]));

  const cmap = cmapTable(
    glyphs.flatMap((g, gid) => (g.unicode !== undefined ? [[g.unicode, gid] as [number, number]] : []))
  );

  const tables: Record<string, Uint8Array> = {
    "OS/2": os2.out(),
    cmap,
    glyf: glyf.out(),
    head,
    hhea,
    hmtx: hmtx.out(),
    loca: loca.out(),
    maxp,
    name: nameTable(spec.family),
    post,
  };
  if (spec.kerning?.length) tables.kern = kernTable(spec.kerning.slice(0, 10900));
  if (spec.alternates?.length) tables.GSUB = gsubTable(spec.alternates);

  // Assemble: directory sorted by tag, each table 4-byte aligned.
  const tags = Object.keys(tables).sort();
  const { searchRange, entrySelector, rangeShift } = binarySearchFields(tags.length, 16);
  const font = new Bytes();
  font.u32(0x00010000).u16(tags.length).u16(searchRange).u16(entrySelector).u16(rangeShift);
  let offset = 12 + tags.length * 16;
  const placed: { tag: string; offset: number }[] = [];
  for (const tag of tags) {
    const data = tables[tag];
    font.tag(tag).u32(checksum(data)).u32(offset).u32(data.length);
    placed.push({ tag, offset });
    offset += Math.ceil(data.length / 4) * 4;
  }
  for (const tag of tags) font.bytes(tables[tag]).pad4();

  const out = font.out();
  const headOffset = placed.find((p) => p.tag === "head")!.offset;
  const adjust = (0xb1b0afba - checksum(out) + 0x100000000) >>> 0;
  new DataView(out.buffer).setUint32(headOffset + 8, adjust);
  return out;
}

/* ------------------------------------------------------------------- woff */

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Wraps a .ttf as WOFF 1.0, the compressed form browsers load for the web. */
export async function toWoff(ttf: Uint8Array): Promise<Uint8Array> {
  const view = new DataView(ttf.buffer, ttf.byteOffset, ttf.byteLength);
  const numTables = view.getUint16(4);
  const entries = [];
  for (let i = 0; i < numTables; i++) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(ttf[at], ttf[at + 1], ttf[at + 2], ttf[at + 3]);
    const sum = view.getUint32(at + 4);
    const offset = view.getUint32(at + 8);
    const length = view.getUint32(at + 12);
    const original = ttf.slice(offset, offset + length);
    const compressed = await deflate(original);
    entries.push({ tag, sum, original, data: compressed.length < original.length ? compressed : original });
  }

  const headerSize = 44 + numTables * 20;
  let offset = headerSize;
  const offsets = entries.map((e) => {
    const at = offset;
    offset += Math.ceil(e.data.length / 4) * 4;
    return at;
  });

  const b = new Bytes();
  b.tag("wOFF").u32(0x00010000).u32(offset).u16(numTables).u16(0).u32(ttf.length);
  b.u16(1).u16(0).u32(0).u32(0).u32(0).u32(0).u32(0);
  entries.forEach((e, i) => b.tag(e.tag).u32(offsets[i]).u32(e.data.length).u32(e.original.length).u32(e.sum));
  entries.forEach((e) => b.bytes(e.data).pad4());
  return b.out();
}
