"use client";

import { useRef, useState } from "react";
import { ImageIcon, LinkIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IMAGE_WARN_BYTES } from "@/lib/site-builder";

const MAX_EDGE = 1600;
const MAX_INPUT_BYTES = 12_000_000;

/**
 * Pictures go into the page as data URLs so an export stays a single file that
 * works anywhere. That only holds up if the file is small, so everything is
 * resized and re-encoded on the way in — a 6 MB phone photo lands around 200 KB.
 */
async function shrink(file: File): Promise<string> {
  if (file.type === "image/svg+xml") return readAsDataUrl(file);
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return readAsDataUrl(file);
  const ratio = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  const context = canvas.getContext("2d");
  if (!context) return readAsDataUrl(file);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const webp = canvas.toDataURL("image/webp", 0.82);
  const jpeg = canvas.toDataURL("image/jpeg", 0.84);
  const best = webp.length < jpeg.length && webp.startsWith("data:image/webp") ? webp : jpeg;
  const original = await readAsDataUrl(file);
  return best.length < original.length ? best : original;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("unreadable"));
    reader.readAsDataURL(file);
  });
}

const sizeOf = (value: string) =>
  value.startsWith("data:") ? Math.floor((value.length - value.indexOf(",") - 1) * 0.75) : 0;

export function ImageField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [linking, setLinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const bytes = sizeOf(value);

  async function take(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("That file is not a picture.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      toast.error("That picture is over 12 MB. Try a smaller one.");
      return;
    }
    setBusy(true);
    try {
      const next = await shrink(file);
      onChange(next);
      const saved = Math.round((1 - sizeOf(next) / file.size) * 100);
      toast.success(saved > 5 ? `Added and made ${saved}% smaller` : "Picture added");
    } catch {
      toast.error("That picture could not be read.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="border-border bg-muted/40 relative overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-28 w-full object-cover" />
          <div className="bg-background/90 absolute right-1.5 top-1.5 flex gap-1 rounded-md p-0.5 backdrop-blur">
            <Button variant="ghost" size="icon-sm" aria-label="Replace picture" onClick={() => input.current?.click()}>
              <UploadIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Remove picture" onClick={() => onChange("")}>
              <Trash2Icon />
            </Button>
          </div>
          {bytes > 0 && (
            <p className={cnSize(bytes)}>{Math.round(bytes / 1024)} KB in the page</p>
          )}
        </div>
      ) : (
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void take(event.dataTransfer.files?.[0]);
          }}
          className="border-border/80 hover:border-primary/50 hover:bg-muted/40 rounded-lg border border-dashed p-4 text-center transition-colors"
        >
          <ImageIcon className="text-muted-foreground mx-auto mb-2 size-5" aria-hidden />
          <p className="text-muted-foreground text-xs">Drop a picture here, or</p>
          <div className="mt-2 flex justify-center gap-1.5">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
              <UploadIcon />
              {busy ? "Working…" : "Choose file"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setLinking((open) => !open)}>
              <LinkIcon />
              Address
            </Button>
          </div>
        </div>
      )}

      {(linking || (!!value && !value.startsWith("data:"))) && (
        <Input
          aria-label="Picture address"
          placeholder="https://…/photo.jpg"
          value={value.startsWith("data:") ? "" : value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Upload a picture"
        onChange={(event) => {
          void take(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}

const cnSize = (bytes: number) =>
  `absolute bottom-1.5 left-1.5 rounded px-1.5 py-0.5 text-[10px] backdrop-blur ${
    bytes > IMAGE_WARN_BYTES ? "bg-amber-500/90 text-amber-950" : "bg-background/85 text-muted-foreground"
  }`;
