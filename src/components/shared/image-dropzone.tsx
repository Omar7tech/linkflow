"use client";

import * as React from "react";
import { ImageIcon, UploadIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Reusable click / drag / drop zone for picking a single image file. */
export function ImageDropzone({
  onFile,
  hint = "PNG, JPG, WebP — stays on your device",
  className,
}: {
  onFile: (file: File) => void;
  hint?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

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
        "flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
        className
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
