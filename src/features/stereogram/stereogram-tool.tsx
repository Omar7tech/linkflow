"use client";

import * as React from "react";
import { DownloadIcon, EyeIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  generateStereogram,
  STEREO_SHAPES,
  type ColorMode,
  type StereoShape,
} from "@/lib/stereogram";
import { cn } from "@/lib/utils";

const W = 960;
const H = 600;

const COLOR_MODES: { id: ColorMode; label: string }[] = [
  { id: "confetti", label: "Confetti" },
  { id: "mono", label: "Mono" },
  { id: "emerald", label: "Emerald" },
];

/** Draw the hidden subject as a white-on-black depth map. */
function drawDepth(mode: "text" | "shape", text: string, shape: StereoShape): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";

  if (mode === "text") {
    const label = (text || "HELLO").toUpperCase();
    let size = 320;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    do {
      ctx.font = `900 ${size}px ui-sans-serif, system-ui, sans-serif`;
      size -= 8;
    } while (ctx.measureText(label).width > W * 0.86 && size > 24);
    ctx.fillText(label, W / 2, H / 2);
  } else {
    drawShape(ctx, shape);
  }
  return ctx.getImageData(0, 0, W, H);
}

function drawShape(ctx: CanvasRenderingContext2D, shape: StereoShape) {
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) * 0.34;
  ctx.beginPath();
  if (shape === "circle") {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  } else if (shape === "triangle") {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.95, cy + r * 0.8);
    ctx.lineTo(cx - r * 0.95, cy + r * 0.8);
    ctx.closePath();
  } else if (shape === "star") {
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else {
    // heart
    const s = r / 16;
    ctx.moveTo(cx, cy + 10 * s);
    ctx.bezierCurveTo(cx + 12 * s, cy - 6 * s, cx + 16 * s, cy - 16 * s, cx, cy - 6 * s);
    ctx.bezierCurveTo(cx - 16 * s, cy - 16 * s, cx - 12 * s, cy - 6 * s, cx, cy + 10 * s);
  }
  ctx.fill();
}

export function StereogramTool() {
  const [mode, setMode] = React.useState<"text" | "shape">("text");
  const [text, setText] = React.useState("HELLO");
  const [shape, setShape] = React.useState<StereoShape>("heart");
  const [depthStrength, setDepthStrength] = React.useState(0.34);
  const [eyeSep, setEyeSep] = React.useState(118);
  const [colorMode, setColorMode] = React.useState<ColorMode>("confetti");
  const [seed, setSeed] = React.useState(0); // bump to re-roll dot colors

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rafRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const depth = drawDepth(mode, text, shape);
      const stereo = generateStereogram(depth, { depthStrength, eyeSep, colorMode });
      canvas.width = W;
      canvas.height = H;
      canvas.getContext("2d")!.putImageData(stereo, 0, 0);
    });
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mode, text, shape, depthStrength, eyeSep, colorMode, seed]);

  const download = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `magic-eye-${mode === "text" ? (text || "hello").toLowerCase() : shape}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.stereogram}
      output={
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your stereogram</CardTitle>
            <CardDescription>Stare through the screen until the hidden shape floats up.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-border overflow-hidden rounded-xl border">
              <canvas ref={canvasRef} className="w-full" />
            </div>
            <div className="flex gap-2">
              <Button onClick={download} className="flex-1">
                <DownloadIcon /> Download PNG
              </Button>
              <Button variant="outline" onClick={() => setSeed((s) => s + 1)}>
                <RefreshCwIcon /> Re-roll dots
              </Button>
            </div>
            <HowTo />
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-5">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "text" | "shape")}>
              <TabsList className="w-full">
                <TabsTrigger value="text" className="flex-1">
                  Hidden text
                </TabsTrigger>
                <TabsTrigger value="shape" className="flex-1">
                  Hidden shape
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="stereo-text">Word to hide</Label>
                  <Input
                    id="stereo-text"
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, 12))}
                    placeholder="HELLO"
                    className="font-mono uppercase"
                  />
                  <p className="text-muted-foreground text-xs">
                    Short words read best — up to ~6 letters fuse most easily.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="shape" className="pt-4">
                <div className="grid grid-cols-4 gap-2">
                  {STEREO_SHAPES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setShape(s)}
                      className={cn(
                        "rounded-lg border py-2 text-xs capitalize transition-colors",
                        shape === s ? "border-foreground bg-muted" : "border-border hover:bg-muted/50"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Dot colors</Label>
              <Tabs value={colorMode} onValueChange={(v) => setColorMode(v as ColorMode)}>
                <TabsList className="w-full">
                  {COLOR_MODES.map((c) => (
                    <TabsTrigger key={c.id} value={c.id} className="flex-1">
                      {c.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <SliderRow
              label="3D depth"
              value={depthStrength}
              min={0.1}
              max={0.6}
              step={0.01}
              display={`${Math.round(depthStrength * 100)}%`}
              onChange={setDepthStrength}
            />
            <SliderRow
              label="Pattern width"
              value={eyeSep}
              min={70}
              max={180}
              step={1}
              display={`${eyeSep}px`}
              onChange={setEyeSep}
            />
            <p className="text-muted-foreground text-xs">
              Wider patterns are easier to fuse but show a chunkier shape. Tweak depth if it won&apos;t
              pop.
            </p>
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}

function HowTo() {
  return (
    <div className="bg-muted/40 border-border space-y-1.5 rounded-lg border p-3 text-xs">
      <p className="flex items-center gap-1.5 font-medium">
        <EyeIcon className="size-3.5" /> How to see it
      </p>
      <ol className="text-muted-foreground list-inside list-decimal space-y-0.5">
        <li>Hold your gaze as if looking through the screen at something far away.</li>
        <li>Let the repeating dots drift and overlap — don&apos;t focus on the surface.</li>
        <li>The hidden shape will slowly rise out in 3D. Be patient on the first try.</li>
      </ol>
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
        <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs tabular-nums">{display}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} aria-label={label} />
    </div>
  );
}
