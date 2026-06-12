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

  const { fgColor, bgColor, size, errorLevel, logoDataUrl } = options;

  React.useEffect(() => {
    if (!value) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      qrToPngDataUrl(value, { fgColor, bgColor, size, errorLevel, logoDataUrl })
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
  }, [value, fgColor, bgColor, size, errorLevel, logoDataUrl]);

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
        className="border-border w-full max-w-55 rounded-xl border bg-white p-2"
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
