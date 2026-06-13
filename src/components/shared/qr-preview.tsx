"use client";

import * as React from "react";
import { DownloadIcon, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { dataUrlToBlob, downloadDataUrl, downloadText, qrToPngDataUrl, qrToSvgString } from "@/lib/qr";
import { DEFAULT_QR_OPTIONS, type QrOptions } from "@/types";
import { cn } from "@/lib/utils";

interface QrPreviewProps {
  value: string;
  options?: QrOptions;
  /** Base name for downloaded files (no extension). */
  filename?: string;
  showActions?: boolean;
  className?: string;
  onAction?: () => void;
}

export function QrPreview({
  value,
  options = DEFAULT_QR_OPTIONS,
  filename = "forma-qr",
  showActions = true,
  className,
  onAction,
}: QrPreviewProps) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);

  const { size } = options;
  // Re-render on any option change without listing each field by hand.
  const optionsKey = JSON.stringify(options);

  React.useEffect(() => {
    if (!value) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      qrToPngDataUrl(value, options)
        .then((url) => {
          if (!cancelled) setDataUrl(url);
        })
        .catch(() => {
          if (!cancelled) setDataUrl(null);
        });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optionsKey captures all option fields
  }, [value, optionsKey]);

  if (!value || !dataUrl) {
    return (
      <div
        className={cn(
          "border-border bg-muted/30 text-muted-foreground flex aspect-square w-full max-w-55 items-center justify-center rounded-xl border border-dashed",
          className
        )}
      >
        <div className="flex flex-col items-center gap-2 p-6 text-center text-xs">
          <ImageIcon className="size-6 opacity-50" />
          QR code appears here as you type
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL, not an asset */}
      <img
        src={dataUrl}
        alt={`QR code for ${value.slice(0, 80)}`}
        className={cn(
          "border-border w-full max-w-55 rounded-xl border p-2",
          options.transparent ? "" : "bg-white"
        )}
        style={
          options.transparent
            ? {
                backgroundImage:
                  "linear-gradient(45deg,#e5e5e5 25%,transparent 25%),linear-gradient(-45deg,#e5e5e5 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e5e5 75%),linear-gradient(-45deg,transparent 75%,#e5e5e5 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
              }
            : undefined
        }
        width={size}
        height={size}
      />
      {showActions && (
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              downloadDataUrl(dataUrl, `${filename}.png`);
              onAction?.();
            }}
          >
            <DownloadIcon /> PNG
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              const svg = await qrToSvgString(value, options);
              downloadText(svg, `${filename}.svg`, "image/svg+xml");
              onAction?.();
            }}
          >
            <DownloadIcon /> SVG
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const blob = await dataUrlToBlob(dataUrl);
                await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
                toast.success("QR image copied to clipboard");
                onAction?.();
              } catch {
                toast.error("Your browser blocked image copy — download instead");
              }
            }}
          >
            Copy image
          </Button>
        </div>
      )}
    </div>
  );
}
