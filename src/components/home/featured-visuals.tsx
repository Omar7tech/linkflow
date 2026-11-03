"use client";

import * as React from "react";
import { CheckCheckIcon, LeafIcon } from "lucide-react";
import QRCode from "qrcode";
import styles from "./featured-pair.module.css";

/*
 * Three small product shots drawn in code. They share one set of rules so they
 * read as a family: the same studio stage as the mockup section, one object in
 * the middle, the site's card surface, neutral tones with emerald as the only
 * accent, and nothing moves until the card is hovered.
 */

const OBJECT =
  "border-border/70 bg-card relative rounded-2xl border shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)]";

function Stage({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      aria-hidden
      className={`absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_70%_80%_at_50%_0%,#ffffff,transparent),linear-gradient(#f4f4f5,#e9e9ec)] dark:bg-[radial-gradient(ellipse_70%_80%_at_50%_0%,#1f1f22,transparent),linear-gradient(#111113,#09090b)] ${className}`}
    >
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------------- qr */

/* A real code. The middle is cleared for the logo, which high error
   correction can afford. */
const QR = (() => {
  const { modules } = QRCode.create("https://casaverde.pt/menu", { errorCorrectionLevel: "H" });
  const n = modules.size;
  const finder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const mid = (n - 1) / 2;
  const logo = (r: number, c: number) => Math.abs(r - mid) <= 3.5 && Math.abs(c - mid) <= 3.5;
  const cells: [number, number][] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (modules.get(r, c) && !finder(r, c) && !logo(r, c)) cells.push([r, c]);
  const corners: [number, number][] = [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ];
  return { n, cells, corners };
})();

const CORNERS = [
  "top-0 left-0 border-t-2 border-l-2 rounded-tl-lg",
  "top-0 right-0 border-t-2 border-r-2 rounded-tr-lg",
  "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg",
  "right-0 bottom-0 border-r-2 border-b-2 rounded-br-lg",
];

/** A QR code with a logo in the middle. On hover it takes the brand colour and a camera reads it. */
export function QrVisual() {
  return (
    <Stage>
      <div className={`${OBJECT} aspect-square h-[64%] p-[8%]`}>
        <div className={`${styles.ink} relative size-full`}>
          <svg viewBox={`0 0 ${QR.n} ${QR.n}`} className="block size-full">
            <g fill="currentColor">
              {QR.cells.map(([r, c]) => (
                <rect key={`${r}-${c}`} x={c + 0.08} y={r + 0.08} width={0.84} height={0.84} rx={0.42} />
              ))}
            </g>
            {QR.corners.map(([r, c]) => (
              <g key={`${r}-${c}`}>
                <rect x={c + 0.5} y={r + 0.5} width={6} height={6} rx={2.2} fill="none" stroke="currentColor" strokeWidth={1} />
                <rect x={c + 2} y={r + 2} width={3} height={3} rx={1} fill="currentColor" />
              </g>
            ))}
          </svg>
          <span className="bg-primary absolute top-1/2 left-1/2 grid size-[20%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[26%] text-white">
            <LeafIcon className="size-1/2" strokeWidth={2.4} />
          </span>
        </div>

        {/* The camera's frame and its read line: hover only. */}
        <span className={`${styles.scanFrame} pointer-events-none absolute -inset-3`}>
          {CORNERS.map((corner) => (
            <span key={corner} className={`border-primary absolute size-5 ${corner}`} />
          ))}
          <span className={`${styles.scanLine} bg-primary absolute inset-x-3 h-px shadow-[0_0_12px_2px_var(--primary)]`} />
        </span>
      </div>
    </Stage>
  );
}

/* ---------------------------------------------------------- background remover */

/**
 * A product photo of a mug, half photo and half cut-out. Hovering the picture
 * hands the wipe to the pointer; hovering the card plays it.
 */
export function CutoutVisual() {
  const [cut, setCut] = React.useState<number | null>(null);
  const held = cut !== null;
  const style = held ? ({ "--cut": `${cut}%` } as React.CSSProperties) : undefined;

  return (
    <Stage>
      <div
        style={style}
        onPointerMove={(event) => {
          if (event.pointerType !== "mouse") return;
          const box = event.currentTarget.getBoundingClientRect();
          setCut(Math.min(96, Math.max(4, ((event.clientX - box.left) / box.width) * 100)));
        }}
        onPointerLeave={() => setCut(null)}
        className={`${OBJECT} aspect-[4/3] h-[66%] cursor-ew-resize overflow-hidden`}
      >
        {/* The photo: a mug on a table, soft daylight. */}
        <div className="absolute inset-0 bg-[linear-gradient(170deg,#f5f5f4,#d6d3d1_70%)] dark:bg-[linear-gradient(170deg,#3f3f46,#27272a_70%)]">
          <div className="absolute inset-x-0 bottom-0 h-[28%] bg-black/[0.06] dark:bg-black/25" />
          <Mug shadow />
        </div>

        {/* The cut-out: the same mug on transparency, traced. */}
        <div
          className={`${held ? styles.cutoutHeld : styles.cutout} absolute inset-0 bg-[#f4f4f5] bg-[length:14px_14px] [background-image:linear-gradient(45deg,#e4e4e7_25%,transparent_25%,transparent_75%,#e4e4e7_75%),linear-gradient(45deg,#e4e4e7_25%,transparent_25%,transparent_75%,#e4e4e7_75%)] [background-position:0_0,7px_7px] dark:bg-[#18181b] dark:[background-image:linear-gradient(45deg,#232326_25%,transparent_25%,transparent_75%,#232326_75%),linear-gradient(45deg,#232326_25%,transparent_25%,transparent_75%,#232326_75%)]`}
        >
          <Mug traced />
        </div>

        <div
          className={`${held ? styles.dividerHeld : styles.divider} absolute inset-y-0 w-px -translate-x-1/2 bg-white shadow-[0_0_10px_rgb(0_0_0/0.3)]`}
        >
          <span className="absolute top-1/2 left-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-neutral-600 shadow">
            <svg viewBox="0 0 16 16" className="size-3">
              <path d="M6 4 2 8l4 4M10 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </Stage>
  );
}

const MUG_BODY =
  "M128 64h76a6 6 0 0 1 6 6v72c0 18-14 30-32 30h-24c-18 0-32-12-32-30V70a6 6 0 0 1 6-6Z";
const MUG_HANDLE =
  "M210 84h8c14 0 24 10 24 23s-10 24-24 24h-9v-14h9c6 0 10-4 10-10s-4-9-10-9h-8Z";

function Mug({ shadow, traced }: { shadow?: boolean; traced?: boolean }) {
  return (
    <svg viewBox="0 0 340 212" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="mug-glaze" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#065f46" />
          <stop offset="0.35" stopColor="#10b981" />
          <stop offset="0.6" stopColor="#34d399" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      {shadow && <ellipse cx="172" cy="176" rx="74" ry="8" fill="#000000" opacity="0.22" />}
      <path d={MUG_HANDLE} fill="#047857" />
      <path d={MUG_BODY} fill="url(#mug-glaze)" />
      <rect x="132" y="68" width="68" height="7" rx="3.5" fill="#022c22" opacity="0.35" />
      <path d="M140 84v52" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" opacity="0.28" />
      {traced && (
        <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="5 4" className={`text-foreground/70 ${styles.ants}`}>
          <path d={MUG_BODY} />
          <path d={MUG_HANDLE} />
        </g>
      )}
    </svg>
  );
}

/* --------------------------------------------------------------------- chat */

/**
 * A chat opened from a click-to-chat link: the message arrived already typed,
 * and the shop answered. On hover the whole trip replays.
 */
export function ChatVisual() {
  return (
    <Stage className="gap-3 px-6">
      <div
        className={`${styles.link} bg-card border-border/70 relative flex items-center gap-1.5 overflow-hidden rounded-full border px-3 py-1.5 font-mono text-[11px] shadow-sm`}
      >
        <span className={`${styles.tap} bg-primary/25 absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full`} />
        <span className="text-muted-foreground relative">wa.me/</span>
        <span className="relative">351912345678</span>
      </div>

      <div className={`${styles.window} ${OBJECT} w-full max-w-[17rem] overflow-hidden`}>
        <div className="border-border/70 flex items-center gap-2.5 border-b px-3.5 py-2.5">
          <span className="bg-primary grid size-7 place-items-center rounded-full text-white">
            <LeafIcon className="size-3.5" strokeWidth={2.4} />
          </span>
          <span className="leading-tight">
            <span className="block text-xs font-medium">Casa Verde</span>
            <span className="text-muted-foreground block text-[10px]">online</span>
          </span>
        </div>
        <div className="flex flex-col gap-1.5 px-3.5 py-3">
          <span
            className={`${styles.sent} bg-primary text-primary-foreground max-w-[85%] self-end rounded-2xl rounded-br-md px-3 py-1.5 text-[11.5px] leading-snug`}
          >
            A table for two on Friday?
            <span className="mt-0.5 flex items-center justify-end gap-1 text-[9px] opacity-80">
              19:42
              <span className="relative inline-grid">
                <CheckCheckIcon className={`${styles.unread} col-start-1 row-start-1 size-3`} />
                <CheckCheckIcon className={`${styles.read} col-start-1 row-start-1 size-3 text-sky-200`} />
              </span>
            </span>
          </span>
          <span className="relative h-7 self-start">
            <span className={`${styles.typing} bg-muted absolute bottom-0 left-0 flex gap-1 rounded-2xl rounded-bl-md px-3 py-2.5`}>
              <span className={`${styles.dot} bg-muted-foreground size-1.5 rounded-full`} />
              <span className={`${styles.dot} bg-muted-foreground size-1.5 rounded-full`} />
              <span className={`${styles.dot} bg-muted-foreground size-1.5 rounded-full`} />
            </span>
            <span
              className={`${styles.reply} bg-muted absolute bottom-0 left-0 rounded-2xl rounded-bl-md px-3 py-1.5 text-[11.5px] leading-snug whitespace-nowrap`}
            >
              Booked. See you at 8.
            </span>
          </span>
        </div>
      </div>
    </Stage>
  );
}
