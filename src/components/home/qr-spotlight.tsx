"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { ArrowRightIcon } from "lucide-react";
import { Reveal } from "@/components/home/reveal";
import { SITE } from "@/constants/site";

/**
 * The home page's door into the QR generator. No preview here: a link goes in,
 * and the generator opens with it already filled in. Behind it, a real code for
 * this site, drawn large and in perspective, fades into the page.
 */
export function QrSpotlight() {
  const router = useRouter();
  const [link, setLink] = React.useState("");

  const open = (event: React.FormEvent) => {
    event.preventDefault();
    const value = link.trim();
    router.push(
      value ? `/tools/qr?v=${encodeURIComponent(value)}` : "/tools/qr",
    );
  };

  return (
    <section
      aria-labelledby="qr-spotlight-heading"
      className="border-border/60 relative isolate overflow-hidden border-y"
    >
      <QrBackdrop />

      <div className="mx-auto w-full max-w-7xl px-6 py-24 sm:py-32">
        <Reveal className="max-w-xl">
          <h2
            id="qr-spotlight-heading"
            className="font-heading text-[2.2rem] leading-[1.04] font-semibold tracking-[-0.035em] text-balance sm:text-5xl"
          >
            A QR code you&rsquo;d actually print
            <span className="text-primary">.</span>
          </h2>
          <p className="text-muted-foreground mt-5 max-w-md text-base leading-relaxed">
            Paste a link and the generator opens with it ready. Add your logo,
            pick the colours, download it in seconds.
          </p>

          <form
            onSubmit={open}
            className="bg-background/80 border-border focus-within:border-primary/60 mt-9 flex h-14 max-w-lg items-center gap-2 rounded-full border pr-1.5 pl-5 backdrop-blur transition-colors"
          >
            <label htmlFor="qr-spotlight-input" className="sr-only">
              Your link
            </label>
            <input
              id="qr-spotlight-input"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              enterKeyHint="go"
              spellCheck={false}
              placeholder="Paste your link"
              className="placeholder:text-muted-foreground/60 h-full min-w-0 flex-1 bg-transparent text-base outline-none"
            />
            <button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90 group inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-5 text-sm font-semibold transition-colors"
            >
              Create QR
              <ArrowRightIcon
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </button>
          </form>
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- backdrop */

/** The real module matrix for this site's address, so the backdrop is unmistakably a QR code. */
const MATRIX = (() => {
  const { modules } = QRCode.create(SITE.url, { errorCorrectionLevel: "M" });
  const size = modules.size;
  const cells: [number, number][] = [];
  const finder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules.get(x, y) && !finder(x, y)) cells.push([x, y]);
    }
  }
  return { size, cells };
})();

/** Pixel size of one module in the backdrop, and the gap between repeated codes. */
const BACKDROP_CELL = 7;
const BACKDROP_GAP = 24;

/**
 * The code repeated edge to edge as a quiet texture: small rounded dots and
 * ringed eyes, faded out along the top and bottom and lighter behind the
 * words. It covers the full width, so no edge ever cuts a shape in half.
 */
function QrBackdrop() {
  const { size, cells } = MATRIX;
  const eyes: [number, number][] = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ];
  const tile = (size + BACKDROP_GAP) * BACKDROP_CELL;

  return (
    <svg
      aria-hidden
      className="text-primary pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-[0.08] [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent),radial-gradient(ellipse_60%_120%_at_80%_50%,black_10%,transparent_80%)] [mask-composite:intersect] [-webkit-mask-composite:source-in] dark:opacity-[0.13]"
    >
      <defs>
        <pattern
          id="qr-backdrop"
          width={tile}
          height={tile}
          patternUnits="userSpaceOnUse"
        >
          <g
            transform={`scale(${BACKDROP_CELL}) translate(${BACKDROP_GAP / 2} ${BACKDROP_GAP / 2})`}
            fill="currentColor"
          >
            {cells.map(([x, y]) => (
              <rect
                key={`${x}-${y}`}
                x={x + 0.14}
                y={y + 0.14}
                width={0.72}
                height={0.72}
                rx={0.36}
              />
            ))}
            {eyes.map(([x, y]) => (
              <g key={`eye-${x}-${y}`}>
                <rect
                  x={x + 0.5}
                  y={y + 0.5}
                  width={6}
                  height={6}
                  rx={1.6}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1}
                />
                <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.9} />
              </g>
            ))}
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#qr-backdrop)" />
    </svg>
  );
}
