"use client";

import * as React from "react";
import { ExternalLinkIcon, Share2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useMounted } from "@/hooks/useMounted";
import type { QrOptions } from "@/types";
import { CopyButton } from "./copy-button";
import { ExportSnippets } from "./export-snippets";
import { QrPreview } from "./qr-preview";

interface OutputCardProps {
  /** The generated link/payload — null while the form is incomplete. */
  output: string | null;
  /** Label used for export snippets, e.g. "Chat on WhatsApp". */
  snippetLabel: string;
  /** Called whenever the user copies/opens/shares — used to commit history. */
  onAction?: () => void;
  /** Hide the QR preview (e.g. the QR tool renders its own). */
  showQr?: boolean;
  qrOptions?: QrOptions;
  filename?: string;
  /** Set false for non-navigable payloads (vCard text, WiFi config). */
  openable?: boolean;
  /** Hide export snippets for outputs that aren't hyperlinks. */
  showSnippets?: boolean;
  emptyHint?: string;
  /** Optional note rendered under the QR preview (e.g. a customize tip). */
  qrTip?: React.ReactNode;
  children?: React.ReactNode;
}

export function OutputCard({
  output,
  snippetLabel,
  onAction,
  showQr = true,
  qrOptions,
  filename = "forma-qr",
  openable = true,
  showSnippets = true,
  emptyHint = "Fill in the form and your link appears here instantly.",
  qrTip,
  children,
}: OutputCardProps) {
  const mounted = useMounted();
  const canNativeShare = mounted && typeof navigator.share === "function";

  return (
    <Card aria-live="polite">
      <CardHeader>
        <CardTitle className="text-base">Your result</CardTitle>
        <CardDescription>
          {output ? "Ready to copy, open or share." : emptyHint}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 border-border min-h-12 rounded-lg border p-3">
          {output ? (
            <code className="block font-mono text-xs break-all">{output}</code>
          ) : (
            <span className="text-muted-foreground text-xs">Waiting for input…</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <CopyButton text={output ?? ""} disabled={!output} onCopied={onAction} />
          {openable && (
            <Button
              type="button"
              variant="outline"
              disabled={!output}
              onClick={() => {
                if (!output) return;
                window.open(output, "_blank", "noopener,noreferrer");
                onAction?.();
              }}
            >
              <ExternalLinkIcon /> Open
            </Button>
          )}
          {canNativeShare && (
            <Button
              type="button"
              variant="outline"
              disabled={!output}
              onClick={async () => {
                if (!output) return;
                try {
                  await navigator.share(
                    openable ? { url: output } : { text: output }
                  );
                  onAction?.();
                } catch {
                  // Share sheet dismissed — nothing to do.
                }
              }}
            >
              <Share2Icon /> Share
            </Button>
          )}
        </div>

        {children}

        {showQr && output && (
          <>
            <Separator />
            <QrPreview value={output} filename={filename} options={qrOptions} onAction={onAction} />
            {qrTip}
          </>
        )}

        {showSnippets && output && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Embed it</h4>
              <ExportSnippets href={output} label={snippetLabel} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function shareOrToast(text: string) {
  if (typeof navigator !== "undefined" && navigator.share) {
    navigator.share({ text }).catch(() => undefined);
  } else {
    toast.info("Native sharing isn't available in this browser");
  }
}
