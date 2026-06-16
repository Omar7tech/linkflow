"use client";

import * as React from "react";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  ImageIcon,
  KeyRoundIcon,
  Loader2Icon,
  LockIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import { capacityBytes, hideMessage, revealMessage } from "@/lib/steganography";
import { cn } from "@/lib/utils";

interface Loaded {
  url: string;
  imageData: ImageData;
  name: string;
}

/** Crypto overhead when a passphrase is used: salt(16) + iv(12) + GCM tag(16). */
const CRYPTO_OVERHEAD = 44;

function fileToImageData(file: File): Promise<Loaded> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please pick an image file"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve({ url, imageData: ctx.getImageData(0, 0, canvas.width, canvas.height), name: file.name });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image"));
    };
    img.src = url;
  });
}

async function imageDataToPngUrl(data: ImageData): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;
  canvas.getContext("2d")!.putImageData(data, 0, 0);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Export failed");
  return URL.createObjectURL(blob);
}

export function SteganographyTool() {
  return (
    <GeneratorLayout tool={TOOL_BY_ID.steganography} output={null}>
      <Card>
        <CardContent>
          <Tabs defaultValue="hide" className="gap-5">
            <TabsList className="w-full">
              <TabsTrigger value="hide" className="flex-1">
                <LockIcon /> Hide
              </TabsTrigger>
              <TabsTrigger value="reveal" className="flex-1">
                <EyeIcon /> Reveal
              </TabsTrigger>
            </TabsList>
            <TabsContent value="hide">
              <HidePanel />
            </TabsContent>
            <TabsContent value="reveal">
              <RevealPanel />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </GeneratorLayout>
  );
}

/* --------------------------------- Hide ----------------------------------- */

function HidePanel() {
  const [cover, setCover] = React.useState<Loaded | null>(null);
  const [message, setMessage] = React.useState("");
  const [pass, setPass] = React.useState("");
  const [result, setResult] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (cover) URL.revokeObjectURL(cover.url);
    };
  }, [cover]);
  React.useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result);
    };
  }, [result]);

  const load = async (file: File) => {
    try {
      const next = await fileToImageData(file);
      setCover((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return next;
      });
      setResult(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const pixels = cover ? (cover.imageData.data.length / 4) | 0 : 0;
  const capacity = cover ? Math.max(0, capacityBytes(pixels) - (pass ? CRYPTO_OVERHEAD : 0)) : 0;
  const used = new TextEncoder().encode(message).length;
  const overCapacity = used > capacity;

  const run = async () => {
    if (!cover || !message.trim()) return;
    setBusy(true);
    try {
      const stego = await hideMessage(cover.imageData, message, pass || undefined);
      const url = await imageDataToPngUrl(stego);
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      toast.success("Message hidden — download your image");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Dropzone
        loaded={cover}
        onFile={load}
        onClear={() => setCover(null)}
        hint="The cover image that will carry your secret"
      />

      {cover && (
        <>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="steg-msg">Secret message</Label>
              <span className={cn("text-[11px]", overCapacity ? "text-destructive" : "text-muted-foreground")}>
                {used} / {capacity} bytes
              </span>
            </div>
            <Textarea
              id="steg-msg"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type the message to hide inside the image…"
              className="resize-none"
            />
            <CapacityBar used={used} capacity={capacity} />
          </div>

          <PassphraseInput
            value={pass}
            onChange={setPass}
            label="Passphrase"
            hint="Optional — encrypts the message with AES-256 so only this key can read it."
          />

          <Button onClick={run} disabled={busy || !message.trim() || overCapacity} className="w-full">
            {busy ? <Loader2Icon className="animate-spin" /> : <LockIcon />}
            {pass ? "Encrypt & hide in image" : "Hide in image"}
          </Button>
        </>
      )}

      {result && (
        <div className="space-y-3">
          <div className="border-border overflow-hidden rounded-xl border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result} alt="Image with hidden message" className="max-h-72 w-full object-contain" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={result} download="secret.png">
                <DownloadIcon /> Download PNG
              </a>
            </Button>
            <span className="text-muted-foreground flex items-center text-xs">
              Looks identical — the secret lives in the pixels.
            </span>
          </div>
          <Warning>
            Keep it a <strong>PNG</strong>. Re-saving as JPG, screenshotting or running it through a
            compressor will scramble the hidden bits.
          </Warning>
        </div>
      )}

      <Privacy />
    </div>
  );
}

/* -------------------------------- Reveal ---------------------------------- */

function RevealPanel() {
  const [carrier, setCarrier] = React.useState<Loaded | null>(null);
  const [pass, setPass] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const [encrypted, setEncrypted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (carrier) URL.revokeObjectURL(carrier.url);
    };
  }, [carrier]);

  const load = async (file: File) => {
    try {
      const next = await fileToImageData(file);
      setCarrier((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return next;
      });
      setMessage(null);
      setError(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const run = async () => {
    if (!carrier) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const out = await revealMessage(carrier.imageData, pass || undefined);
      setMessage(out.message);
      setEncrypted(out.encrypted);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-5">
      <Dropzone
        loaded={carrier}
        onFile={load}
        onClear={() => setCarrier(null)}
        hint="A PNG that may contain a hidden message"
      />

      {carrier && (
        <>
          <PassphraseInput
            value={pass}
            onChange={setPass}
            label="Passphrase"
            hint="Required only if the message was encrypted."
          />
          <Button onClick={run} disabled={busy} className="w-full">
            {busy ? <Loader2Icon className="animate-spin" /> : <EyeIcon />}
            Reveal hidden message
          </Button>
        </>
      )}

      {error && <Warning tone="error">{error}</Warning>}

      {message !== null && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Hidden message{encrypted && " (decrypted)"}</Label>
            <button
              type="button"
              onClick={copy}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
            >
              {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <Textarea readOnly rows={4} value={message} className="resize-none font-mono text-sm" />
        </div>
      )}

      <Privacy />
    </div>
  );
}

/* ------------------------------ shared bits ------------------------------- */

function Dropzone({
  loaded,
  onFile,
  onClear,
  hint,
}: {
  loaded: Loaded | null;
  onFile: (file: File) => void;
  onClear: () => void;
  hint: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  if (loaded) {
    return (
      <div className="border-border flex items-center gap-3 rounded-xl border p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={loaded.url} alt={loaded.name} className="size-14 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{loaded.name}</p>
          <p className="text-muted-foreground text-xs">
            {loaded.imageData.width} × {loaded.imageData.height}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => ref.current?.click()}>
          Replace
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClear} aria-label="Remove">
          <XIcon />
        </Button>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => ref.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
      )}
    >
      <UploadIcon className={cn("size-6", dragging ? "text-primary" : "text-muted-foreground")} />
      <span className="text-sm font-medium">Drop, paste or click to upload</span>
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        <ImageIcon className="size-3.5" /> {hint}
      </span>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function PassphraseInput({
  value,
  onChange,
  label,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  hint: string;
}) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <KeyRoundIcon className="size-3.5" /> {label}
      </Label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Leave empty to skip encryption"
          autoComplete="off"
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
          aria-label={show ? "Hide passphrase" : "Show passphrase"}
        >
          {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </div>
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}

function CapacityBar({ used, capacity }: { used: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min(100, (used / capacity) * 100) : 0;
  return (
    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
      <div
        className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-destructive" : "bg-primary")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Warning({ children, tone = "warn" }: { children: React.ReactNode; tone?: "warn" | "error" }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg border p-2.5 text-xs",
        tone === "error"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
      )}
    >
      <SparklesIcon className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function Privacy() {
  return (
    <p className="text-muted-foreground flex items-start gap-2 text-xs">
      <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      Encoding, AES encryption and decoding all happen on this device — your image and message are
      never uploaded.
    </p>
  );
}
