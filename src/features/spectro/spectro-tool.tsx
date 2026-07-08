"use client";

import * as React from "react";
import {
  DownloadIcon,
  ImageIcon,
  Loader2Icon,
  MusicIcon,
  PlayIcon,
  SquareIcon,
  UploadIcon,
  WandSparklesIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  computeSpectrogram,
  encodeWav,
  SAMPLE_RATE,
  spectrogramToImageData,
  synthesize,
} from "@/lib/spectro";

/** Vertical resolution of the hidden picture (one sine oscillator per row). */
const ROWS = 96;
/** Longest slice of an uploaded file we decode, in seconds. */
const DECODE_CAP_S = 20;

type Mode = "text" | "image" | "decode";

interface AudioResult {
  samples: Float32Array<ArrayBuffer>;
  sampleRate: number;
  /** Highest frequency worth showing in the spectrogram view. */
  displayMaxFreq: number;
}

/** Paint the message into a brightness grid the synth can play. */
function rasterizeText(text: string, cols: number): Float32Array {
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = ROWS;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cols, ROWS);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const label = text.trim() || "HELLO";
  let size = ROWS * 0.82;
  do {
    ctx.font = `900 ${size}px ui-sans-serif, system-ui, sans-serif`;
    size -= 1;
  } while (ctx.measureText(label).width > cols * 0.94 && size > 6);
  ctx.fillText(label, cols / 2, ROWS / 2);

  return gridFromCanvas(ctx, cols, false);
}

function rasterizeImage(bitmap: ImageBitmap, cols: number, invert: boolean): Float32Array {
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = ROWS;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = invert ? "#fff" : "#000";
  ctx.fillRect(0, 0, cols, ROWS);
  const scale = Math.min(cols / bitmap.width, ROWS / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (cols - w) / 2, (ROWS - h) / 2, w, h);
  return gridFromCanvas(ctx, cols, invert);
}

function gridFromCanvas(
  ctx: CanvasRenderingContext2D,
  cols: number,
  invert: boolean
): Float32Array {
  const { data } = ctx.getImageData(0, 0, cols, ROWS);
  const grid = new Float32Array(ROWS * cols);
  for (let i = 0; i < grid.length; i++) {
    const o = i * 4;
    const luma = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
    let v = invert ? 1 - luma : luma;
    if (v < 0.06) v = 0; // keep the background truly silent
    grid[i] = v * v; // gamma: mid-grays ring too loud otherwise
  }
  return grid;
}

export function SpectroTool() {
  const [mode, setMode] = React.useState<Mode>("text");
  const [text, setText] = React.useState("HELLO");
  const [bitmap, setBitmap] = React.useState<ImageBitmap | null>(null);
  const [invert, setInvert] = React.useState(false);
  const [duration, setDuration] = React.useState(5);
  const [fMin, setFMin] = React.useState(500);
  const [fMax, setFMax] = React.useState(7600);
  const [audio, setAudio] = React.useState<AudioResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [decodedName, setDecodedName] = React.useState<string | null>(null);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const playheadRef = React.useRef<HTMLDivElement>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const sourceRef = React.useRef<AudioBufferSourceNode | null>(null);
  const rafRef = React.useRef<number | undefined>(undefined);

  // Regenerate audio (debounced) whenever the message or synth settings change.
  React.useEffect(() => {
    if (mode === "decode") return;
    if (mode === "image" && !bitmap) return;
    let cancelled = false;
    const debounce = setTimeout(() => {
      setBusy(true);
      // Yield a frame so the spinner paints before the synchronous synth runs.
      setTimeout(() => {
        if (cancelled) return;
        const cols = Math.max(40, Math.round(duration * 28));
        const grid =
          mode === "text" ? rasterizeText(text, cols) : rasterizeImage(bitmap!, cols, invert);
        const samples = synthesize(grid, ROWS, cols, { duration, fMin, fMax });
        setAudio({ samples, sampleRate: SAMPLE_RATE, displayMaxFreq: fMax * 1.12 });
        setBusy(false);
      }, 30);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [mode, text, bitmap, invert, duration, fMin, fMax]);

  // Repaint the spectrogram whenever the audio changes.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audio) return;
    const spec = computeSpectrogram(audio.samples, audio.sampleRate, audio.displayMaxFreq);
    canvas.width = spec.width;
    canvas.height = spec.height;
    canvas.getContext("2d")!.putImageData(spectrogramToImageData(spec), 0, 0);
  }, [audio]);

  const stop = React.useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (playheadRef.current) playheadRef.current.style.opacity = "0";
    setPlaying(false);
  }, []);

  React.useEffect(() => stop, [audio, stop]);

  const play = () => {
    if (!audio) return;
    if (playing) {
      stop();
      return;
    }
    const ctx = (audioCtxRef.current ??= new AudioContext());
    void ctx.resume();
    const buffer = ctx.createBuffer(1, audio.samples.length, audio.sampleRate);
    buffer.copyToChannel(audio.samples, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = stop;
    source.start();
    sourceRef.current = source;
    setPlaying(true);

    const startedAt = ctx.currentTime;
    const total = buffer.duration;
    const tick = () => {
      const head = playheadRef.current;
      if (!head || !sourceRef.current) return;
      const progress = Math.min((ctx.currentTime - startedAt) / total, 1);
      head.style.opacity = "1";
      head.style.left = `${progress * 100}%`;
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const loadImage = async (file: File) => {
    try {
      setBitmap(await createImageBitmap(file));
    } catch {
      toast.error("Couldn't read that image.");
    }
  };

  const decodeFile = async (file: File) => {
    stop();
    setBusy(true);
    try {
      const ctx = (audioCtxRef.current ??= new AudioContext());
      const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
      const cap = Math.min(decoded.length, Math.round(DECODE_CAP_S * decoded.sampleRate));
      const mono = new Float32Array(cap);
      for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
        const data = decoded.getChannelData(ch);
        for (let i = 0; i < cap; i++) mono[i] += data[i] / decoded.numberOfChannels;
      }
      setDecodedName(file.name);
      setAudio({ samples: mono, sampleRate: decoded.sampleRate, displayMaxFreq: 10000 });
    } catch {
      toast.error("Couldn't decode that file — try WAV, MP3 or OGG.");
    } finally {
      setBusy(false);
    }
  };

  const downloadWav = () => {
    if (!audio) return;
    const url = URL.createObjectURL(encodeWav(audio.samples, audio.sampleRate));
    const a = document.createElement("a");
    a.href = url;
    a.download = `audio-secret-${mode === "text" ? (text.trim() || "hello").toLowerCase().replace(/\s+/g, "-").slice(0, 24) : "image"}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPng = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "spectrogram.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const switchMode = (next: Mode) => {
    stop();
    if (next !== "decode") setDecodedName(null);
    setMode(next);
  };

  const hasOutput = audio !== null && !(mode === "image" && !bitmap);

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.spectro}
      output={
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {mode === "decode" ? "Revealed spectrogram" : "Your sound, seen"}
            </CardTitle>
            <CardDescription>
              {mode === "decode"
                ? decodedName
                  ? `Time runs left to right in ${decodedName} — hidden art lives in the pattern.`
                  : "Drop an audio file to see what's painted inside it."
                : "This is the actual audio below, viewed as frequencies over time."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-border relative overflow-hidden rounded-xl border bg-[#071410]">
              <canvas
                ref={canvasRef}
                className={hasOutput ? "block w-full" : "block aspect-[16/10] w-full opacity-0"}
              />
              {!hasOutput && (
                <p className="text-muted-foreground absolute inset-0 flex items-center justify-center px-6 text-center text-sm">
                  {mode === "image"
                    ? "Upload an image to turn it into sound."
                    : "Drop an audio file to reveal its spectrogram."}
                </p>
              )}
              {busy && (
                <span className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5">
                  <Loader2Icon className="size-3.5 animate-spin text-white" />
                </span>
              )}
              <div
                ref={playheadRef}
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-px bg-white/80 opacity-0"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={play} disabled={!hasOutput} className="flex-1">
                {playing ? <SquareIcon /> : <PlayIcon />}
                {playing ? "Stop" : "Play the sound"}
              </Button>
            </div>
            <div className="flex gap-2">
              {mode !== "decode" && (
                <Button variant="outline" onClick={downloadWav} disabled={!hasOutput} className="flex-1">
                  <DownloadIcon /> WAV
                </Button>
              )}
              <Button variant="outline" onClick={downloadPng} disabled={!hasOutput} className="flex-1">
                <DownloadIcon /> PNG
              </Button>
            </div>
            <HowItWorks />
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-5">
            <Tabs value={mode} onValueChange={(v) => switchMode(v as Mode)}>
              <TabsList className="w-full">
                <TabsTrigger value="text" className="flex-1">
                  Hide text
                </TabsTrigger>
                <TabsTrigger value="image" className="flex-1">
                  Hide image
                </TabsTrigger>
                <TabsTrigger value="decode" className="flex-1">
                  Decode audio
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="spectro-text">Message to hide</Label>
                  <Input
                    id="spectro-text"
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, 32))}
                    placeholder="HELLO"
                    className="font-mono"
                  />
                  <p className="text-muted-foreground text-xs">
                    Short words stay crisp. Longer messages? Raise the duration below.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="image" className="space-y-4 pt-4">
                <label className="border-border hover:bg-muted/50 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors">
                  <ImageIcon className="text-muted-foreground size-6" />
                  <span className="text-sm font-medium">
                    {bitmap ? "Replace image" : "Upload an image"}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Logos and bold shapes work best — fine detail melts into the noise.
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void loadImage(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                <div className="flex items-center justify-between">
                  <Label htmlFor="spectro-invert">Invert brightness</Label>
                  <Switch id="spectro-invert" checked={invert} onCheckedChange={setInvert} />
                </div>
              </TabsContent>

              <TabsContent value="decode" className="pt-4">
                <label className="border-border hover:bg-muted/50 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors">
                  <UploadIcon className="text-muted-foreground size-6" />
                  <span className="text-sm font-medium">
                    {decodedName ?? "Drop in any audio file"}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    WAV, MP3 or OGG — the first {DECODE_CAP_S} seconds are analyzed.
                  </span>
                  <input
                    type="file"
                    accept="audio/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void decodeFile(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                <p className="text-muted-foreground pt-3 text-xs">
                  Try a WAV made with this tool — or hunt for the faces and spirals artists like
                  Aphex Twin buried in their tracks.
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {mode !== "decode" && (
          <Card>
            <CardContent className="space-y-5">
              <SliderRow
                label="Duration"
                value={duration}
                min={2}
                max={12}
                step={0.5}
                display={`${duration.toFixed(1)}s`}
                onChange={setDuration}
              />
              <SliderRow
                label="Lowest pitch"
                value={fMin}
                min={200}
                max={2000}
                step={50}
                display={`${fMin} Hz`}
                onChange={setFMin}
              />
              <SliderRow
                label="Highest pitch"
                value={fMax}
                min={2500}
                max={9500}
                step={100}
                display={`${fMax} Hz`}
                onChange={setFMax}
              />
              <p className="text-muted-foreground text-xs">
                The picture is painted between these two pitches — a wider band means a taller,
                clearer image but a shriller sound.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </GeneratorLayout>
  );
}

function HowItWorks() {
  return (
    <div className="bg-muted/40 border-border space-y-1.5 rounded-lg border p-3 text-xs">
      <p className="flex items-center gap-1.5 font-medium">
        <WandSparklesIcon className="size-3.5" /> How the trick works
      </p>
      <p className="text-muted-foreground">
        Every row of pixels becomes a sine wave at its own pitch; brightness sets its volume. Play
        all the waves together and the sound carries the picture — invisible to the ear, obvious to
        the eye in any spectrogram app (Audacity, Spek, or this decoder).
      </p>
      <p className="text-muted-foreground flex items-center gap-1.5">
        <MusicIcon className="size-3 shrink-0" /> Aphex Twin hid his own face this way in
        “Windowlicker” back in 1999.
      </p>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs tabular-nums">
          {display}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        aria-label={label}
      />
    </div>
  );
}
