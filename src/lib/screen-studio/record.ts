/**
 * Records the screen (with its sound and your microphone mixed in), an
 * optional camera for the bubble, and, where the browser offers speech
 * recognition, captions of what you say, timed to the recording.
 */
import { uid, type Caption } from "./types";

export interface RecordOptions {
  mic: boolean;
  camera: boolean;
  captions: boolean;
}

export interface Recording {
  screen: Blob;
  camera: Blob | null;
  captions: Caption[];
}

export interface Session {
  stop: () => void;
  done: Promise<Recording>;
  /** Live camera preview while recording. */
  cameraStream: MediaStream | null;
  startedAt: number;
}

function pickMime(kind: "video") {
  const options = kind === "video" ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"] : [];
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

type SpeechCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export const speechSupported = () =>
  typeof window !== "undefined" && !!((window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);

/** Asks for the screen first, so the picker comes before any countdown. */
export async function pickScreen(): Promise<MediaStream> {
  return navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 60 }, width: { ideal: 3840 }, height: { ideal: 2160 } },
    audio: true,
    // Chrome: leave this tab out of the list and offer to share tab audio.
    ...({ selfBrowserSurface: "exclude", systemAudio: "include" } as object),
  });
}

export async function startRecording(display: MediaStream, opts: RecordOptions): Promise<Session> {
  const extra: MediaStream[] = [];
  let mic: MediaStream | null = null;
  let camera: MediaStream | null = null;
  if (opts.mic) {
    mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).catch(() => null);
    if (mic) extra.push(mic);
  }
  if (opts.camera) {
    camera = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } }).catch(() => null);
    if (camera) extra.push(camera);
  }

  // Screen sound and voice, mixed into one track.
  const audioIn = [display, mic].filter((s): s is MediaStream => !!s && s.getAudioTracks().length > 0);
  let mixed: MediaStreamTrack | null = null;
  let audioCtx: AudioContext | null = null;
  if (audioIn.length === 1) mixed = audioIn[0].getAudioTracks()[0];
  else if (audioIn.length > 1) {
    audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    for (const s of audioIn) audioCtx.createMediaStreamSource(s).connect(dest);
    mixed = dest.stream.getAudioTracks()[0];
  }
  const stream = new MediaStream([...display.getVideoTracks(), ...(mixed ? [mixed] : [])]);
  const mime = pickMime("video");
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 16_000_000 });
  const camRec = camera ? new MediaRecorder(camera, { mimeType: pickMime("video").replace(/,opus/, ""), videoBitsPerSecond: 3_000_000 }) : null;
  const chunks: Blob[] = [];
  const camChunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  if (camRec) camRec.ondataavailable = (e) => e.data.size && camChunks.push(e.data);

  // Captions from your voice.
  const captions: Caption[] = [];
  let speech: InstanceType<SpeechCtor> | null = null;
  let live = true;
  const startedAt = performance.now();
  const now = () => (performance.now() - startedAt) / 1000;
  if (opts.captions && mic) {
    const Ctor = ((window as unknown as { SpeechRecognition?: SpeechCtor }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SpeechCtor }).webkitSpeechRecognition) as SpeechCtor | undefined;
    if (Ctor) {
      speech = new Ctor();
      speech.continuous = true;
      speech.interimResults = true;
      speech.lang = navigator.language || "en-US";
      let phraseStart = -1;
      speech.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (phraseStart < 0) phraseStart = Math.max(0, now() - 0.6);
          if (r.isFinal) {
            const text = r[0].transcript.trim();
            if (text) captions.push({ id: uid(), start: phraseStart, end: now() + 0.3, text: text[0].toUpperCase() + text.slice(1) });
            phraseStart = -1;
          }
        }
      };
      // Recognition stops itself after silences; keep it going.
      speech.onend = () => {
        if (live) {
          try {
            speech?.start();
          } catch {
            // Already running.
          }
        }
      };
      speech.onerror = () => {};
      try {
        speech.start();
      } catch {
        speech = null;
      }
    }
  }

  rec.start(1000);
  camRec?.start(1000);

  let stopped = false;
  const done = new Promise<Recording>((resolve) => {
    rec.onstop = async () => {
      if (camRec && camRec.state !== "inactive") await new Promise((r) => ((camRec.onstop = r), camRec.stop()));
      for (const s of [display, ...extra]) s.getTracks().forEach((t) => t.stop());
      audioCtx?.close();
      resolve({
        screen: new Blob(chunks, { type: mime.split(";")[0] }),
        camera: camChunks.length ? new Blob(camChunks, { type: "video/webm" }) : null,
        captions: mergeCaptions(captions),
      });
    };
  });
  const stop = () => {
    if (stopped) return;
    stopped = true;
    live = false;
    speech?.stop();
    if (rec.state !== "inactive") rec.stop();
  };
  // The browser's own "Stop sharing" button ends the recording too.
  display.getVideoTracks()[0]?.addEventListener("ended", stop);
  return { stop, done, cameraStream: camera, startedAt };
}

/** Splits long phrases into readable caption lengths. */
function mergeCaptions(list: Caption[]): Caption[] {
  const out: Caption[] = [];
  for (const c of list) {
    const words = c.text.split(/\s+/);
    if (words.length <= 12) {
      out.push(c);
      continue;
    }
    const parts = Math.ceil(words.length / 10);
    const per = (c.end - c.start) / parts;
    for (let i = 0; i < parts; i++)
      out.push({ id: uid(), start: c.start + per * i, end: c.start + per * (i + 1), text: words.slice(i * 10, (i + 1) * 10).join(" ") });
  }
  return out;
}
