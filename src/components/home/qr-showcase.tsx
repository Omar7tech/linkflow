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
  const [failed, setFailed] = React.useState(false);

  // Re-render on any option change without listing each field by hand.
  const optionsKey = JSON.stringify(options);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { buildQrSvg } = await import("@/lib/qr");
        if (cancelled) return;
        const markup = buildQrSvg(value, options);
        if (cancelled) return;
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

  // Resting pose: a card lying at an angle on a desk. The pointer leans it.
  const [tilt, setTilt] = React.useState(REST);
  const printed = printedLine(label);

  return (
    <figure className="w-full max-w-[17rem] [perspective:1400px] sm:max-w-xs lg:max-w-[21rem]">
      <div
        onPointerMove={(event) => {
          if (event.pointerType !== "mouse") return;
          const box = event.currentTarget.getBoundingClientRect();
          const x = (event.clientX - box.left) / box.width - 0.5;
          const y = (event.clientY - box.top) / box.height - 0.5;
          setTilt({ x: -y * 14, y: x * 18 });
        }}
        onPointerLeave={() => setTilt(REST)}
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
        className="relative rounded-[1.4rem] bg-[#f3f2ec] px-[10%] pt-[10%] pb-[7%] shadow-[0_1px_0_rgb(255_255_255/0.9)_inset,0_0_0_1px_rgb(0_0_0/0.06),0_2px_2px_rgb(0_0_0/0.15),0_40px_80px_-30px_rgb(0_0_0/0.75)] transition-transform duration-500 ease-out will-change-transform motion-reduce:transform-none"
      >
        {/* Light across the paper. Codes are printed dark-on-light: an
            inverted code is unreliable on a fair share of scanners. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(135deg,rgb(255_255_255/0.75),transparent_42%,rgb(0_0_0/0.05))]"
        />
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
        <div className="relative mt-[8%] flex items-baseline justify-between gap-3 text-neutral-500">
          <span className="text-[10px] font-semibold tracking-[0.2em] text-neutral-800">
            SCAN ME
          </span>
          <span className="truncate text-[11px]">{printed}</span>
        </div>
      </div>
      <figcaption className="text-muted-foreground mt-7 text-center text-xs">
        {failed ? (
          <span className="text-destructive">Too much text for one code</span>
        ) : (
          "Point your phone camera at it"
        )}
      </figcaption>
    </figure>
  );
}

const REST = { x: 10, y: -16 };

/** What a printer would put under the code: the host of a link, or the start of the text. */
function printedLine(value: string): string {
  try {
    const url = new URL(
      /^[a-z]+:\/\//i.test(value) ? value : `https://${value}`,
    );
    if (url.hostname.includes(".")) return url.hostname.replace(/^www\./, "");
  } catch {
    // Not a link; fall through to the text itself.
  }
  return value.length > 28 ? `${value.slice(0, 27)}…` : value;
}
