"use client";

import Link from "next/link";
import { SparklesIcon } from "lucide-react";
import { CopyButton } from "./copy-button";

/**
 * A nudge shown under a generated QR: copy the link and finish it off in the
 * dedicated QR tool, where colors, eye styles and a logo can be added.
 */
export function QrCustomizeTip({ url }: { url: string }) {
  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
      <SparklesIcon className="size-3.5 shrink-0" aria-hidden />
      <span>Want custom colors, eye styles or a logo?</span>
      <CopyButton
        text={url}
        label="Copy the link"
        variant="link"
        size="xs"
        className="h-auto px-0 underline"
        successMessage="Link copied — paste it into the QR tool"
      />
      <span>then open the</span>
      <Link
        href="/tools/qr"
        className="text-foreground font-medium underline underline-offset-2 hover:no-underline"
      >
        QR Code Generator
      </Link>
      .
    </p>
  );
}
