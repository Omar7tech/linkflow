/**
 * A small MP4 writer for WebCodecs output: one H.264 video track and an
 * optional AAC or Opus audio track, with the index (moov) written before the
 * media so the file plays and seeks immediately.
 *
 * The video track is tagged BT.709, limited range, which is how the encoder
 * converts the canvas's RGB. Without that tag players guess, and a wrong
 * guess is what makes exports look darker and more contrasty than the screen.
 */

type Bytes = Uint8Array;

const enc = new TextEncoder();
const u8 = (n: number) => [n & 255];
const u16 = (n: number) => [(n >> 8) & 255, n & 255];
const u24 = (n: number) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u64 = (n: number) => [...u32(Math.floor(n / 2 ** 32)), ...u32(n >>> 0)];
const str = (s: string) => [...enc.encode(s)];

function concat(parts: (Bytes | number[])[]): Bytes {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const box = (type: string, ...parts: (Bytes | number[])[]) => {
  const body = concat(parts);
  return concat([u32(body.length + 8), str(type), body]);
};
const full = (type: string, version: number, flags: number, ...parts: (Bytes | number[])[]) => box(type, [version, ...u24(flags)], ...parts);

const MATRIX = [...u32(0x00010000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x00010000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x40000000)];

interface Sample {
  data: Bytes;
  /** Microseconds. */
  ts: number;
  dur: number;
  key: boolean;
}

export interface Mp4Options {
  width: number;
  height: number;
  audio?: { codec: "aac" | "opus"; sampleRate: number; channels: number; description?: Bytes };
}

/** Run-length table of sample durations. */
function stts(durs: number[]) {
  const runs: [number, number][] = [];
  for (const d of durs) {
    const last = runs[runs.length - 1];
    if (last && last[1] === d) last[0]++;
    else runs.push([1, d]);
  }
  return full("stts", 0, 0, u32(runs.length), runs.flatMap(([n, d]) => [...u32(n), ...u32(d)]));
}

function descriptor(tag: number, body: number[]) {
  const n = body.length;
  return [tag, 0x80 | ((n >> 21) & 127), 0x80 | ((n >> 14) & 127), 0x80 | ((n >> 7) & 127), n & 127, ...body];
}

function audioSpecificConfig(rate: number, channels: number) {
  const rates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
  const fi = Math.max(0, rates.indexOf(rate));
  const v = (2 << 11) | (fi << 7) | (channels << 3);
  return [(v >> 8) & 255, v & 255];
}

export class Mp4Writer {
  private video: Sample[] = [];
  private audio: Sample[] = [];
  private avcC: Bytes | null = null;

  constructor(private opts: Mp4Options) {}

  addVideo(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) {
    const desc = meta?.decoderConfig?.description;
    if (desc && !this.avcC) this.avcC = desc instanceof ArrayBuffer ? new Uint8Array(desc) : new Uint8Array((desc as ArrayBufferView).buffer, (desc as ArrayBufferView).byteOffset, (desc as ArrayBufferView).byteLength);
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    this.video.push({ data, ts: chunk.timestamp, dur: chunk.duration ?? 0, key: chunk.type === "key" });
  }

  addAudio(chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) {
    const desc = meta?.decoderConfig?.description;
    if (desc && this.opts.audio && !this.opts.audio.description)
      this.opts.audio.description = desc instanceof ArrayBuffer ? new Uint8Array(desc) : new Uint8Array((desc as ArrayBufferView).buffer, (desc as ArrayBufferView).byteOffset, (desc as ArrayBufferView).byteLength);
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    this.audio.push({ data, ts: chunk.timestamp, dur: chunk.duration ?? 0, key: true });
  }

  private durations(list: Sample[], timescale: number) {
    const out: number[] = [];
    for (let i = 0; i < list.length; i++) {
      const next = list[i + 1];
      const us = next ? next.ts - list[i].ts : list[i].dur || (i > 0 ? list[i].ts - list[i - 1].ts : 33333);
      out.push(Math.max(1, Math.round((us * timescale) / 1e6)));
    }
    return out;
  }

  private track(id: number, kind: "video" | "audio", list: Sample[], offsets: number[]) {
    const o = this.opts;
    const timescale = kind === "video" ? 90000 : o.audio!.sampleRate;
    const durs = this.durations(list, timescale);
    const total = durs.reduce((a, b) => a + b, 0);
    const movieDur = Math.round((total / timescale) * 1000);

    let entry: Bytes;
    if (kind === "video") {
      const colr = box("colr", str("nclx"), u16(1), u16(1), u16(1), u8(0));
      entry = box(
        "avc1",
        new Array(6).fill(0),
        u16(1),
        u16(0),
        u16(0),
        new Array(12).fill(0),
        u16(o.width),
        u16(o.height),
        u32(0x00480000),
        u32(0x00480000),
        u32(0),
        u16(1),
        new Array(32).fill(0),
        u16(0x0018),
        u16(0xffff),
        box("avcC", this.avcC ?? new Uint8Array()),
        colr,
        box("pasp", u32(1), u32(1))
      );
    } else {
      const a = o.audio!;
      const head = [...new Array(6).fill(0), ...u16(1), ...u32(0), ...u32(0), ...u16(a.channels), ...u16(16), ...u16(0), ...u16(0), ...u32(Math.min(65535, a.sampleRate) * 65536)];
      if (a.codec === "aac") {
        const asc = a.description ? [...a.description] : audioSpecificConfig(a.sampleRate, a.channels);
        const es = descriptor(3, [...u16(1), 0, ...descriptor(4, [0x40, 0x15, ...u24(0), ...u32(192000), ...u32(160000), ...descriptor(5, asc)]), ...descriptor(6, [2])]);
        entry = box("mp4a", head, full("esds", 0, 0, es));
      } else {
        // dOps is big-endian, unlike the OpusHead the encoder may hand back.
        const preSkip = a.description && a.description.length >= 12 ? a.description[10] | (a.description[11] << 8) : 312;
        entry = box("Opus", head, box("dOps", u8(0), u8(a.channels), u16(preSkip), u32(a.sampleRate), u16(0), u8(0)));
      }
    }

    const stbl = box(
      "stbl",
      full("stsd", 0, 0, u32(1), entry),
      stts(durs),
      ...(kind === "video" ? [full("stss", 0, 0, u32(list.filter((s) => s.key).length), list.flatMap((s, i) => (s.key ? u32(i + 1) : [])))] : []),
      full("stsc", 0, 0, u32(1), u32(1), u32(1), u32(1)),
      full("stsz", 0, 0, u32(0), u32(list.length), list.flatMap((s) => u32(s.data.length))),
      full("co64", 0, 0, u32(list.length), offsets.flatMap((x) => u64(x)))
    );
    const media = box(
      "mdia",
      full("mdhd", 0, 0, u32(0), u32(0), u32(timescale), u32(total), u16(0x55c4), u16(0)),
      full("hdlr", 0, 0, u32(0), str(kind === "video" ? "vide" : "soun"), new Array(12).fill(0), str(kind === "video" ? "VideoHandler\0" : "SoundHandler\0")),
      box(
        "minf",
        kind === "video" ? full("vmhd", 0, 1, u16(0), u16(0), u16(0), u16(0)) : full("smhd", 0, 0, u16(0), u16(0)),
        box("dinf", full("dref", 0, 0, u32(1), full("url ", 0, 1))),
        stbl
      )
    );
    const tkhd = full(
      "tkhd",
      0,
      3,
      u32(0),
      u32(0),
      u32(id),
      u32(0),
      u32(movieDur),
      u32(0),
      u32(0),
      u16(0),
      u16(0),
      u16(kind === "audio" ? 0x0100 : 0),
      u16(0),
      MATRIX,
      u32(kind === "video" ? o.width * 65536 : 0),
      u32(kind === "video" ? o.height * 65536 : 0)
    );
    return { trak: box("trak", tkhd, media), movieDur };
  }

  private moov(videoOffsets: number[], audioOffsets: number[]) {
    const v = this.track(1, "video", this.video, videoOffsets);
    const a = this.audio.length && this.opts.audio ? this.track(2, "audio", this.audio, audioOffsets) : null;
    const dur = Math.max(v.movieDur, a?.movieDur ?? 0);
    const mvhd = full("mvhd", 0, 0, u32(0), u32(0), u32(1000), u32(dur), u32(0x00010000), u16(0x0100), new Array(10).fill(0), MATRIX, new Array(24).fill(0), u32(a ? 3 : 2));
    return box("moov", mvhd, v.trak, ...(a ? [a.trak] : []));
  }

  finish(): Blob {
    const ftyp = box("ftyp", str("isom"), u32(512), str("isom"), str("iso2"), str("avc1"), str("mp41"));
    const mdatHead = 16;
    // Offsets depend on the index's size, which doesn't depend on the offsets.
    const zerosV = this.video.map(() => 0);
    const zerosA = this.audio.map(() => 0);
    const size = this.moov(zerosV, zerosA).length;
    let at = ftyp.length + size + mdatHead;
    const vOff = this.video.map((s) => {
      const o = at;
      at += s.data.length;
      return o;
    });
    const aOff = this.audio.map((s) => {
      const o = at;
      at += s.data.length;
      return o;
    });
    const moov = this.moov(vOff, aOff);
    const mdatSize = at - ftyp.length - moov.length;
    const mdat = new Uint8Array([...u32(1), ...str("mdat"), ...u64(mdatSize)]);
    return new Blob([ftyp as BlobPart, moov as BlobPart, mdat as BlobPart, ...this.video.map((s) => s.data as BlobPart), ...this.audio.map((s) => s.data as BlobPart)], { type: "video/mp4" });
  }
}
