"use client";

import * as React from "react";
import styles from "./qr-showcase.module.css";
import type { QrOptions } from "@/types";

interface QrArtboardProps {
  /** Text actually encoded into the code. */
  value: string;
  options: QrOptions;
  /** Human description of the payload, for screen readers. */
  label: string;
}

/**
 * Renders the real, scannable QR for whatever is typed in the spotlight.
 * `@/lib/qr` (and its `qrcode` dependency) is pulled in on the client only
 * once this mounts, so the homepage bundle stays light; the skeleton holds
 * the exact square footprint in the meantime, so nothing shifts.
 */
export function QrArtboard({ value, options, label }: QrArtboardProps) {
  const [svg, setSvg] = React.useState<string | null>(null);
  const [modules, setModules] = React.useState<number | null>(null);
  const [failed, setFailed] = React.useState(false);

  // Re-render on any option change without listing each field by hand.
  const optionsKey = JSON.stringify(options);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ buildQrSvg }, qrcode] = await Promise.all([
          import("@/lib/qr"),
          import("qrcode"),
        ]);
        if (cancelled) return;
        const matrix = qrcode.default.create(value, {
          errorCorrectionLevel: options.errorLevel,
        });
        const markup = buildQrSvg(value, options);
        if (cancelled) return;
        setModules(matrix.modules.size);
        setSvg(markup);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optionsKey captures all option fields
  }, [value, optionsKey]);

  return (
    <figure className="w-full max-w-md">
      {/* A white plate in both themes: real codes are printed dark-on-light,
          and an inverted code is unreliable on a fair share of scanners. */}
      <div className="relative">
        <CropMark className="-top-2 -left-2 border-t border-l" />
        <CropMark className="-top-2 -right-2 border-t border-r" />
        <CropMark className="-bottom-2 -left-2 border-b border-l" />
        <CropMark className="-right-2 -bottom-2 border-r border-b" />

        <div className="border-border/70 rounded-sm border bg-white p-[12%] dark:shadow-[0_24px_70px_-30px_rgba(0,0,0,0.9)]">
          {svg && !failed ? (
            <div
              key={svg.length}
              role="img"
              aria-label={`QR code for ${label}`}
              className={styles.qr}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <div className={styles.skeleton} aria-hidden />
          )}
        </div>
      </div>

      <figcaption className="text-muted-foreground/80 mt-4 flex items-center justify-between gap-4 font-mono text-[11px] tracking-[0.16em] uppercase tabular-nums">
        {failed ? (
          <span className="text-destructive normal-case">Too much data for one code</span>
        ) : (
          <span>
            {modules ? `${modules} × ${modules} modules` : "Rendering"} · ECC {options.errorLevel}
          </span>
        )}
        <span className="shrink-0">Scan to test</span>
      </figcaption>
    </figure>
  );
}

/** Hairline crop mark, print-plate style. */
function CropMark({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`border-foreground/20 pointer-events-none absolute size-3.5 ${className}`}
    />
  );
}
