"use client";

import * as React from "react";
import { CheckCheckIcon, LinkIcon } from "lucide-react";
import styles from "./featured-pair.module.css";

/* ---------------------------------------------------------- background remover */

/**
 * A product shot of a mug, shown as the photo and as the cut-out, with a wipe
 * between them. It sweeps on its own; hovering hands the wipe to the pointer.
 * The cut-out side has no table and no shadow, and marching ants trace the edge.
 */
export function CutoutVisual() {
  const [cut, setCut] = React.useState<number | null>(null);
  const held = cut !== null;
  const style = held
    ? ({ "--cut": `${cut}%` } as React.CSSProperties)
    : undefined;

  return (
    <div
      aria-hidden
      style={style}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse") return;
        const box = event.currentTarget.getBoundingClientRect();
        setCut(
          Math.min(
            96,
            Math.max(4, ((event.clientX - box.left) / box.width) * 100),
          ),
        );
      }}
      onPointerLeave={() => setCut(null)}
      className="absolute inset-0 cursor-ew-resize"
    >
      {/* The photo: a mug on a table in warm light. */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,#fff7ed,transparent_45%),linear-gradient(160deg,#fed7aa,#fb923c_55%,#c2410c)]">
        <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-b from-[#9a3412]/30 to-[#7c2d12]/60" />
        <Mug shadow />
      </div>

      {/* The cut-out: the same mug on transparency, traced. */}
      <div
        className={`${held ? styles.cutoutHeld : styles.cutout} absolute inset-0 bg-[#ececec] bg-[length:18px_18px] [background-image:linear-gradient(45deg,#d9d9d9_25%,transparent_25%,transparent_75%,#d9d9d9_75%),linear-gradient(45deg,#d9d9d9_25%,transparent_25%,transparent_75%,#d9d9d9_75%)] [background-position:0_0,9px_9px] dark:bg-[#1b1b1b] dark:[background-image:linear-gradient(45deg,#242424_25%,transparent_25%,transparent_75%,#242424_75%),linear-gradient(45deg,#242424_25%,transparent_25%,transparent_75%,#242424_75%)]`}
      >
        <Mug traced />
        <span className="bg-background/85 border-border absolute top-3 right-3 rounded-full border px-2.5 py-1 font-mono text-[10px] backdrop-blur">
          PNG · transparent
        </span>
      </div>

      {/* The wipe's handle. */}
      <div
        className={`${held ? styles.dividerHeld : styles.divider} absolute inset-y-0 w-px -translate-x-1/2 bg-white/90 shadow-[0_0_14px_rgb(0_0_0/0.35)]`}
      >
        <span className="absolute top-1/2 left-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white shadow-md">
          <svg viewBox="0 0 16 16" className="size-3.5 text-neutral-700">
            <path
              d="M6 4 2 8l4 4M10 4l4 4-4 4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </div>
  );
}

/** The mug outline, shared by the fill and the marching-ants trace. */
const MUG_BODY =
  "M128 64h76a6 6 0 0 1 6 6v72c0 18-14 30-32 30h-24c-18 0-32-12-32-30V70a6 6 0 0 1 6-6Z";
const MUG_HANDLE =
  "M210 84h8c14 0 24 10 24 23s-10 24-24 24h-9v-14h9c6 0 10-4 10-10s-4-9-10-9h-8Z";

function Mug({ shadow, traced }: { shadow?: boolean; traced?: boolean }) {
  return (
    <svg
      viewBox="0 0 340 212"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <linearGradient id="mug-glaze" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#065f46" />
          <stop offset="0.35" stopColor="#10b981" />
          <stop offset="0.6" stopColor="#34d399" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      {shadow && (
        <ellipse
          cx="172"
          cy="176"
          rx="78"
          ry="9"
          fill="#431407"
          opacity="0.35"
        />
      )}
      {/* Steam. */}
      <g
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        opacity={traced ? 0 : 0.7}
        className={styles.steam}
      >
        <path d="M150 52c-6-8 6-14 0-24" />
        <path d="M168 50c-6-8 6-14 0-24" />
        <path d="M186 52c-6-8 6-14 0-24" />
      </g>
      <path d={MUG_HANDLE} fill="url(#mug-glaze)" />
      <path d={MUG_BODY} fill="url(#mug-glaze)" />
      <rect
        x="132"
        y="68"
        width="68"
        height="7"
        rx="3.5"
        fill="#022c22"
        opacity="0.35"
      />
      <path
        d="M140 84v52"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.28"
      />
      {traced && (
        <g
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.6"
          strokeDasharray="5 4"
          className={styles.ants}
        >
          <path d={MUG_BODY} />
          <path d={MUG_HANDLE} />
        </g>
      )}
    </svg>
  );
}

/* --------------------------------------------------------------------- chat */

/**
 * The whole trip of a click-to-chat link: the link is tapped, the chat opens
 * with the message already sent, it is read, and the shop answers.
 */
export function ChatVisual() {
  return (
    <div
      aria-hidden
      className="bg-muted/40 absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle,rgb(127_127_127/0.14)_1px,transparent_1px)] bg-[length:16px_16px] px-6"
    >
      <div
        className={`${styles.link} bg-background border-border relative flex max-w-full items-center gap-2 overflow-hidden rounded-full border px-3.5 py-2 text-xs shadow-sm`}
      >
        <span
          className={`${styles.tap} bg-primary/25 absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full`}
        />
        <LinkIcon className="text-primary relative size-3.5 shrink-0" />
        <span className="relative truncate font-mono">
          wa.me/351912345678
          <span className="text-muted-foreground">
            ?text=Hi! I&apos;d like to book…
          </span>
        </span>
      </div>

      <div
        className={`${styles.window} bg-background border-border w-full max-w-[19rem] overflow-hidden rounded-2xl border shadow-lg`}
      >
        <div className="border-border flex items-center gap-2.5 border-b px-3.5 py-2.5">
          <span className="bg-primary/15 text-primary grid size-7 place-items-center rounded-full text-[11px] font-semibold">
            CV
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-xs font-medium">Casa Verde</span>
            <span className="text-primary block text-[10px]">online</span>
          </span>
        </div>
        <div className="flex h-[7.5rem] flex-col justify-end gap-1.5 px-3.5 py-3">
          <span
            className={`${styles.sent} bg-primary text-primary-foreground self-end rounded-2xl rounded-br-md px-3 py-1.5 text-xs leading-snug shadow-sm`}
          >
            Hi! I&apos;d like to book a table for two on Friday.
            <span className="mt-0.5 flex items-center justify-end gap-1 text-[9px] opacity-80">
              19:42
              <span className="relative inline-grid">
                <CheckCheckIcon
                  className={`${styles.unread} col-start-1 row-start-1 size-3`}
                />
                <CheckCheckIcon
                  className={`${styles.read} col-start-1 row-start-1 size-3 text-sky-200`}
                />
              </span>
            </span>
          </span>
          <span className="relative h-7 self-start">
            <span
              className={`${styles.typing} bg-muted absolute bottom-0 left-0 flex gap-1 rounded-2xl rounded-bl-md px-3 py-2.5`}
            >
              <span
                className={`${styles.dot} bg-muted-foreground size-1.5 rounded-full`}
              />
              <span
                className={`${styles.dot} bg-muted-foreground size-1.5 rounded-full`}
              />
              <span
                className={`${styles.dot} bg-muted-foreground size-1.5 rounded-full`}
              />
            </span>
            <span
              className={`${styles.reply} bg-muted absolute bottom-0 left-0 rounded-2xl rounded-bl-md px-3 py-1.5 text-xs leading-snug whitespace-nowrap`}
            >
              Done! See you at 8 🌿
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
