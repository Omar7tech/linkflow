/**
 * Tool cards: a small drawing of what each tool makes, in place of a picture.
 *
 * Each scene shows the tool's result, often as a before-and-after, in the
 * card's category colour (`--card-accent`) and the page's own neutrals, so the
 * grid reads as one set. Scenes hold still until their card is hovered and then
 * act out the job a little: dozens of cards on a page never animate at once.
 */
import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { WhatsAppIcon } from "./brand-icons";

const A = "var(--card-accent)";
const soft = (amount: number, base = "transparent") =>
  `color-mix(in oklab, var(--card-accent) ${amount}%, ${base})`;
const move = "transition-transform duration-500 ease-out";
const delay = (ms: number): CSSProperties => ({ transitionDelay: `${ms}ms` });

/* ----------------------------------------------------------------- pieces */

function Fill({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`absolute inset-0 ${className}`}>{children}</div>;
}

function Center({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center ${className}`}
    >
      {children}
    </div>
  );
}

/** A grey placeholder line of text. */
function Bar({
  w,
  className = "",
  strong,
}: {
  w: string;
  className?: string;
  strong?: boolean;
}) {
  return (
    <span
      className={`block h-1.5 rounded-full ${strong ? "bg-foreground/45" : "bg-foreground/15"} ${className}`}
      style={{ width: w }}
    />
  );
}

/** A small app or browser window. */
function Win({
  children,
  className = "",
  style,
  bar = true,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  bar?: boolean;
}) {
  return (
    <div
      className={`border-border bg-card overflow-hidden rounded-xl border shadow-[0_18px_40px_-20px_rgb(0_0_0/0.55)] ${className}`}
      style={style}
    >
      {bar && (
        <div className="border-border/70 flex items-center gap-1 border-b px-2 py-1.5">
          <span className="size-1.5 rounded-full bg-foreground/20" />
          <span className="size-1.5 rounded-full bg-foreground/20" />
          <span className="size-1.5 rounded-full bg-foreground/20" />
        </div>
      )}
      {children}
    </div>
  );
}

/** Pseudo-random but fixed, so server and browser draw the same picture. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

/** A QR-like block of modules with its three eyes, drawn in the accent. */
function MiniCode({
  size,
  cells = 17,
  seed = 7,
  color = A,
}: {
  size: number;
  cells?: number;
  seed?: number;
  color?: string;
}) {
  const unit = size / cells;
  const random = seeded(seed);
  const corner = (x: number, y: number) => x < 5 && y < 5;
  const isEye = (x: number, y: number) =>
    corner(x, y) || corner(cells - 1 - x, y) || corner(x, cells - 1 - y);
  const modules: ReactNode[] = [];
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      if (!isEye(x, y) && random() > 0.5) {
        modules.push(
          <rect
            key={`${x}-${y}`}
            x={x * unit + 0.3}
            y={y * unit + 0.3}
            width={unit - 0.6}
            height={unit - 0.6}
            rx={unit * 0.28}
            fill={color}
          />,
        );
      }
    }
  }
  const eye = (x: number, y: number) => (
    <g key={`eye-${x}-${y}`}>
      <rect
        x={x + unit * 0.5}
        y={y + unit * 0.5}
        width={unit * 4}
        height={unit * 4}
        rx={unit * 1.2}
        fill="none"
        stroke={color}
        strokeWidth={unit}
      />
      <rect
        x={x + unit * 1.5}
        y={y + unit * 1.5}
        width={unit * 2}
        height={unit * 2}
        rx={unit * 0.6}
        fill={color}
      />
    </g>
  );
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
      {modules}
      {eye(0, 0)}
      {eye((cells - 5) * unit, 0)}
      {eye(0, (cells - 5) * unit)}
    </svg>
  );
}

/** A small landscape photo: sky, sun and two hills, in the accent. */
function Photo({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`overflow-hidden ${className.includes("absolute") ? "" : "relative"} ${className}`}
      style={{
        background: `linear-gradient(180deg, ${soft(35, "#fff7ed")}, ${soft(15, "#fde68a")})`,
        ...style,
      }}
    >
      <span className="absolute top-[18%] right-[22%] size-[18%] rounded-full bg-amber-300" />
      <span
        className="absolute -bottom-[30%] -left-[10%] h-[70%] w-[75%] rounded-[50%]"
        style={{ background: soft(70, "#065f46") }}
      />
      <span
        className="absolute -right-[15%] -bottom-[40%] h-[80%] w-[80%] rounded-[50%]"
        style={{ background: soft(90, "#022c22") }}
      />
    </div>
  );
}

const CHECKER =
  "bg-[#ececec] bg-[length:12px_12px] [background-image:linear-gradient(45deg,#d9d9d9_25%,transparent_25%,transparent_75%,#d9d9d9_75%),linear-gradient(45deg,#d9d9d9_25%,transparent_25%,transparent_75%,#d9d9d9_75%)] [background-position:0_0,6px_6px] dark:bg-[#1b1b1b] dark:[background-image:linear-gradient(45deg,#262626_25%,transparent_25%,transparent_75%,#262626_75%),linear-gradient(45deg,#262626_25%,transparent_25%,transparent_75%,#262626_75%)]";

/** A tiny app screen: header, a hero card and a list, for device mockups. */
/** A geometric N, for the 3D logo scene. */
const MONOGRAM = "M20 84V16h17l26 42V16h17v68H63L37 42v42Z";

/** A small calendar app, for the store screenshots. */
function PhoneScreen() {
  const rows: [string, string, string][] = [
    ["Design review", "10:00", A],
    ["Ship v2.4", "14:30", "#a1a1aa"],
    ["Call with Ana", "16:00", "#a1a1aa"],
    ["Write changelog", "17:15", "#a1a1aa"],
  ];
  return (
    <div className="h-full rounded-t-[9px] bg-white px-[9%] pt-[12%] text-neutral-900">
      <p className="text-[7px] font-semibold tracking-tight">This week</p>
      <div className="mt-[8%] flex justify-between">
        {["M", "T", "W", "T", "F"].map((d, i) => (
          <span
            key={i}
            className={`grid size-[13px] place-items-center rounded-full text-[5px] font-medium ${i === 2 ? "text-white" : "text-neutral-500"}`}
            style={i === 2 ? { background: A } : undefined}
          >
            {d}
          </span>
        ))}
      </div>
      <div className="mt-[10%] space-y-[7%]">
        {rows.map(([title, time, dot]) => (
          <div key={title} className="flex items-center gap-[6%] border-b border-neutral-100 pb-[5%]">
            <span className="size-[4px] shrink-0 rounded-full" style={{ background: dot }} />
            <span className="flex-1 truncate text-[5.5px] font-medium">{title}</span>
            <span className="font-mono text-[5px] text-neutral-400">{time}</span>
          </div>
        ))}
      </div>
      <div className="mt-[10%] rounded-[5px] bg-neutral-100 p-[7%]">
        <div className="flex justify-between text-[5px]">
          <span className="font-medium">Focus time</span>
          <span className="font-mono text-neutral-500">2h 30m</span>
        </div>
        <div className="mt-[6%] h-[3px] overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full w-[62%] rounded-full" style={{ background: A }} />
        </div>
      </div>
    </div>
  );
}

interface Person {
  name: string;
  bg: string;
  skin: string;
  hair: string;
  shirt: string;
  style: "short" | "bob" | "bun" | "curly" | "long";
}

/** Calm, desaturated portraits: no cartoon smiles, just shape and colour. */
const PEOPLE: Person[] = [
  { name: "Theo", bg: "#dfe5ec", skin: "#e8c4a2", hair: "#2b2421", shirt: "#3f4a5a", style: "short" },
  { name: "Mira", bg: "#e6e0d8", skin: "#c99a74", hair: "#1f1a17", shirt: "#7a5c46", style: "bob" },
  { name: "Lena", bg: "#dbe6df", skin: "#8d5a3c", hair: "#18120f", shirt: "#2f4a3d", style: "curly" },
  { name: "Sam", bg: "#e5e1ea", skin: "#f1d3b8", hair: "#b0743f", shirt: "#4b4560", style: "bun" },
  { name: "Ivy", bg: "#e9e4dc", skin: "#d8ab86", hair: "#4a2f24", shirt: "#5d5048", style: "long" },
];

const HAIR: Record<Person["style"], (c: string) => ReactNode> = {
  short: (c) => <path d="M20 30c-1-10 5-16 12-16s13 5 12 16c-2-5-6-8-12-8s-10 3-12 8Z" fill={c} />,
  bob: (c) => <path d="M18 38c-2-14 4-23 14-23s16 9 14 23c-2 0-3-2-3-4v-6c-2-4-6-6-11-6s-9 2-11 6v6c0 2-1 4-3 4Z" fill={c} />,
  bun: (c) => (
    <>
      <circle cx="32" cy="12" r="5.5" fill={c} />
      <path d="M20 30c-1-10 5-16 12-16s13 6 12 16c-2-5-6-8-12-8s-10 3-12 8Z" fill={c} />
    </>
  ),
  curly: (c) => (
    <g fill={c}>
      {[
        [21, 25, 6],
        [26, 19, 6.5],
        [32, 17, 7],
        [38, 19, 6.5],
        [43, 25, 6],
      ].map(([x, y, r]) => (
        <circle key={x} cx={x} cy={y} r={r} />
      ))}
    </g>
  ),
  long: (c) => <path d="M18 50c-3-20 2-35 14-35s17 15 14 35h-4V30c-2-4-6-7-10-7s-8 3-10 7v20Z" fill={c} />,
};

function Face({ person, className = "", style }: { person: Person; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" className={`shrink-0 rounded-full ${className}`} style={{ background: person.bg, ...style }} aria-hidden>
      {person.style === "long" && HAIR.long(person.hair)}
      <path d="M12 64c2-11 10-16 20-16s18 5 20 16Z" fill={person.shirt} />
      <rect x="28" y="40" width="8" height="9" rx="3" fill={person.skin} />
      <ellipse cx="32" cy="30" rx="11" ry="12.5" fill={person.skin} />
      {person.style !== "long" && HAIR[person.style](person.hair)}
      {person.style === "long" && <path d="M21 29c1-6 5-9 11-9s10 3 11 9c-3-3-7-4-11-4s-8 1-11 4Z" fill={person.hair} />}
      <circle cx="27.5" cy="31.5" r="1.3" fill="#1c1917" />
      <circle cx="36.5" cy="31.5" r="1.3" fill="#1c1917" />
    </svg>
  );
}

/** Fan-out offsets for the avatar row (static strings for Tailwind). */
const FAN = ["", "group-hover:translate-x-[4px]", "group-hover:translate-x-[8px]", "group-hover:translate-x-[12px]", "group-hover:translate-x-[16px]", "group-hover:translate-x-[20px]"];

/* ------------------------------------------------------------------ scenes */

/**
 * A 16 × 16 favicon drawn pixel for pixel: a rounded tile with an N, so the
 * magnified view shows real pixels, not a smooth vector pretending.
 */
const MARK_ROWS = Array.from({ length: 16 }, (_, y) =>
  Array.from({ length: 16 }, (_, x) => {
    const corner = (x < 2 || x > 13) && (y < 2 || y > 13) && Math.min(x, 15 - x) + Math.min(y, 15 - y) < 2;
    if (corner) return ".";
    const n = y >= 4 && y <= 11 && (x === 4 || x === 5 || x === 10 || x === 11 || (x >= 6 && x <= 9 && y >= 5 && y <= 10 && (x - y === 0 || x - y === 1)));
    return n ? "w" : "a";
  }).join("")
);

function PixelMark({ size }: { size: number }) {
  const p = size / 16;
  const runs: { x: number; y: number; w: number; c: string }[] = [];
  MARK_ROWS.forEach((row, y) => {
    let x = 0;
    while (x < 16) {
      const c = row[x];
      let w = 1;
      while (x + w < 16 && row[x + w] === c) w++;
      if (c !== ".") runs.push({ x, y, w, c });
      x += w;
    }
  });
  return (
    <g shapeRendering="crispEdges">
      {runs.map((r, i) => (
        <rect key={i} x={r.x * p} y={r.y * p} width={r.w * p} height={p} fill={r.c === "w" ? "#ffffff" : A} />
      ))}
    </g>
  );
}

export const SCENES: Record<string, () => ReactNode> = {
  /* ============================================================ studio */

  poster: () => (
    // Three real prints from the generator, fanned on the table. On hover
    // they spread apart, the way you'd shuffle through proofs.
    <Center>
      {[
        {
          // Albers squares.
          base: "-translate-x-[62%] -rotate-[9deg] group-hover:-translate-x-[92%] group-hover:-rotate-[15deg]",
          art: (
            <>
              <rect width="100" height="141" fill="#ece4d3" />
              <rect x="10" y="12" width="80" height="80" fill="#1b1b1b" />
              <rect x="20" y="27" width="60" height="60" fill="#1d4fa6" />
              <rect x="30" y="42" width="40" height="40" fill="#f2bd1d" />
              <text x="10" y="114" fontSize="15" fontWeight="700" fill="#1b1b1b" letterSpacing="-0.6">Neue Form</text>
              <rect x="10" y="121" width="26" height="2" fill="#1b1b1b" />
              <rect x="10" y="126" width="18" height="1.6" fill="#1b1b1b" opacity="0.6" />
            </>
          ),
        },
        {
          // Halves: the headline changes colour as it crosses the border.
          base: "translate-x-[62%] rotate-[8deg] group-hover:translate-x-[92%] group-hover:rotate-[14deg]",
          art: (
            <>
              <rect width="100" height="141" fill="#e9b949" />
              <rect y="66" width="100" height="75" fill="#1a1612" />
              <clipPath id="scene-top">
                <rect width="100" height="66" />
              </clipPath>
              <clipPath id="scene-bottom">
                <rect y="66" width="100" height="75" />
              </clipPath>
              <g fontSize="30" fontWeight="700" letterSpacing="-1.4">
                <text x="8" y="64" fill="#1a1612" clipPath="url(#scene-top)">Neue</text>
                <text x="8" y="64" fill="#e9b949" clipPath="url(#scene-bottom)">Neue</text>
                <text x="8" y="92" fill="#e9b949">Form</text>
              </g>
              <circle cx="84" cy="66" r="6" fill="#c8361c" />
              <rect x="8" y="122" width="30" height="2" fill="#e9b949" />
              <rect x="8" y="127" width="20" height="1.6" fill="#e9b949" opacity="0.6" />
            </>
          ),
        },
        {
          // Circle, in front.
          base: "z-10 group-hover:-translate-y-[4%]",
          art: (
            <>
              <rect width="100" height="141" fill="#f1ede4" />
              <circle cx="70" cy="48" r="31" fill="#e3241b" />
              <circle cx="84" cy="68" r="10" fill="none" stroke="#141414" strokeWidth="1" />
              <text x="9" y="16" fontSize="5" fontWeight="700" fill="#141414">Grafik und Raum</text>
              <rect x="9" y="20" width="16" height="1.4" fill="#141414" />
              <rect x="9" y="23.5" width="12" height="1.4" fill="#141414" opacity="0.6" />
              <g fontSize="25" fontWeight="700" letterSpacing="-1.3" fill="#141414">
                <text x="8" y="108">Neue</text>
                <text x="8" y="131">Form</text>
              </g>
              <text x="91" y="131" fontSize="3.6" fill="#141414" textAnchor="end" fontFamily="ui-monospace, monospace">N° 27</text>
            </>
          ),
        },
      ].map((poster, i) => (
        <svg
          key={i}
          viewBox="0 0 100 141"
          aria-hidden
          fontFamily={`"Helvetica Neue", Helvetica, Arial, sans-serif`}
          className={`absolute h-[78%] w-auto shadow-[0_10px_24px_-10px_rgb(0_0_0/0.55)] transition-transform duration-500 ease-out ${poster.base}`}
        >
          {poster.art}
        </svg>
      ))}
    </Center>
  ),

  screenstudio: () => (
    // A real screen, framed, with the edit's timecode. On hover the camera
    // eases in on the invite field the way the editor would cut it, and the
    // playhead runs into the zoom on the timeline.
    <Fill className="overflow-hidden">
      <svg viewBox="0 0 160 100" aria-hidden className="absolute inset-0 h-full w-full" fontFamily={`-apple-system, "Segoe UI", Helvetica, Arial, sans-serif`}>
        <defs>
          <clipPath id="scene-ss-frame">
            <rect x="20" y="10" width="120" height="66" rx="3" />
          </clipPath>
        </defs>
        {/* Frame. */}
        <rect x="20" y="10" width="120" height="66" rx="3" fill="var(--muted)" stroke="var(--border)" strokeWidth="0.4" />
        <g clipPath="url(#scene-ss-frame)">
          <g className="transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.75]" style={{ transformOrigin: "86px 44px" }}>
            {/* The recorded app. */}
            <rect x="32" y="18" width="96" height="58" rx="2" fill="#fafafa" stroke="#e4e4e7" strokeWidth="0.3" />
            <text x="40" y="29" fontSize="4.6" fontWeight="600" fill="#18181b" letterSpacing="-0.1">
              Invite your team
            </text>
            <text x="40" y="34.2" fontSize="2.5" fill="#71717a">
              Collaborators can view and edit every project.
            </text>
            <rect x="40" y="39" width="56" height="8" rx="1.2" fill="#ffffff" stroke="#d4d4d8" strokeWidth="0.35" />
            <text x="43" y="44.2" fontSize="2.7" fill="#18181b">
              maya@northfold.co
            </text>
            <rect x="57.6" y="41" width="0.3" height="4" fill="#18181b" />
            <rect x="99" y="39" width="22" height="8" rx="1.2" fill={A} />
            <text x="110" y="44.2" fontSize="2.6" fontWeight="600" fill="#ffffff" textAnchor="middle">
              Send invite
            </text>
            <line x1="40" y1="53" x2="121" y2="53" stroke="#e4e4e7" strokeWidth="0.3" />
            {[
              ["MC", "Maya Chen", "Editor"],
              ["JB", "Jonas Berg", "Viewer"],
            ].map(([i, name, role], k) => (
              <g key={name} transform={`translate(40 ${57 + k * 8})`}>
                <circle cx="2.6" cy="2.6" r="2.6" fill="#e4e4e7" />
                <text x="2.6" y="3.5" fontSize="2" fontWeight="600" fill="#52525b" textAnchor="middle">
                  {i}
                </text>
                <text x="8" y="3.4" fontSize="2.6" fill="#27272a">
                  {name}
                </text>
                <text x="81" y="3.4" fontSize="2.4" fill="#a1a1aa" textAnchor="end">
                  {role}
                </text>
              </g>
            ))}
            <path d="M104 42.5 v5.2 l1.3 -1.2 l1.1 2.3 l0.85 -0.4 l-1.1 -2.25 h1.8 z" fill="#18181b" stroke="#ffffff" strokeWidth="0.3" />
          </g>
          {/* Timecode. */}
          <rect x="23" y="68.4" width="17" height="4.6" rx="0.8" fill="#18181b" opacity="0.85" />
          <text x="31.5" y="71.7" fontSize="2.5" fill="#fafafa" textAnchor="middle" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
            00:04:12
          </text>
        </g>

        {/* Timeline. */}
        <g transform="translate(20 84)">
          <line x1="0" y1="3" x2="120" y2="3" stroke="var(--border)" strokeWidth="0.5" />
          {Array.from({ length: 13 }, (_, i) => (
            <line key={i} x1={i * 10} y1="1.6" x2={i * 10} y2="3" stroke="var(--border)" strokeWidth="0.4" />
          ))}
          <rect x="52" y="4.6" width="34" height="3.6" rx="0.8" fill="none" stroke={A} strokeWidth="0.45" />
          <text x="54" y="7.3" fontSize="2.3" fill={A} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
            zoom 1.8×
          </text>
          <g className="transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-[34px]">
            <line x1="30" y1="-0.5" x2="30" y2="9" stroke="var(--foreground)" strokeWidth="0.5" />
          </g>
        </g>
      </svg>
    </Fill>
  ),

  readme: () => (
    // A README, nothing else: banner, badges, a feature row. On hover the
    // page scrolls to the install line and the markdown is copied.
    <Fill className="overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse 55% 65% at 50% 35%, ${soft(18)}, transparent 70%)` }}
      />
      <svg
        viewBox="0 0 160 100"
        aria-hidden
        className="absolute top-[12%] left-1/2 h-[100%] w-auto -translate-x-1/2 drop-shadow-[0_14px_28px_rgb(0_0_0/0.5)]"
        fontFamily={`-apple-system, "Segoe UI", Helvetica, Arial, sans-serif`}
      >
        <defs>
          <linearGradient id="scene-readme-banner" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={A} stopOpacity="0.08" />
            <stop offset="0.5" stopColor={A} stopOpacity="0.32" />
            <stop offset="1" stopColor={A} stopOpacity="0.08" />
          </linearGradient>
          <clipPath id="scene-readme-page">
            <rect x="24" y="9" width="112" height="91" />
          </clipPath>
        </defs>
        <rect x="24" y="0" width="112" height="100" rx="4" fill="#0d1117" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="0.5" />
        <text x="31" y="6" fontSize="3" fontWeight="600" fill="#f0f6fc" fillOpacity="0.85">
          README.md
        </text>
        <line x1="24" y1="9" x2="136" y2="9" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="0.4" />

        <g clipPath="url(#scene-readme-page)">
          <g className="transition-transform duration-700 ease-out group-hover:-translate-y-[22px]">
            <rect x="30" y="15" width="100" height="28" rx="2.5" fill="url(#scene-readme-banner)" />
            <text x="80" y="31" fontSize="8.5" fontWeight="800" fill="#f0f6fc" textAnchor="middle" letterSpacing="-0.3">
              TM Tools
            </text>
            <rect x="62" y="35" width="36" height="1.4" rx="0.7" fill="#f0f6fc" opacity="0.3" />

            {[0, 1, 2].map((i) => (
              <g key={i} transform={`translate(${57 + i * 16} 48)`}>
                <rect width="14" height="3.6" rx="0.6" fill="#ffffff" fillOpacity="0.12" />
                <rect x="7" width="7" height="3.6" rx="0.6" fill={A} opacity={1 - i * 0.2} />
              </g>
            ))}

            <rect x="34" y="60" width="22" height="2.4" rx="1" fill="#f0f6fc" opacity="0.85" />
            <line x1="34" y1="65" x2="126" y2="65" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="0.4" />
            {[0, 1, 2].map((i) => (
              <g key={i} transform={`translate(${34 + i * 31.3} 69)`}>
                <rect width="4" height="4" rx="1" fill={A} opacity={0.9 - i * 0.2} />
                <rect y="7" width={20 - i * 3} height="1.6" rx="0.8" fill="#f0f6fc" opacity="0.7" />
                <rect y="10.5" width="26" height="1.2" rx="0.6" fill="#f0f6fc" opacity="0.25" />
                <rect y="13.5" width={18 + i * 3} height="1.2" rx="0.6" fill="#f0f6fc" opacity="0.25" />
              </g>
            ))}

            <rect x="34" y="94" width="92" height="9" rx="1.5" fill="#ffffff" fillOpacity="0.05" />
            <text x="38" y="99.6" fontSize="3" fill="#9198a1" fontFamily="ui-monospace, monospace">
              npm install <tspan fill={A}>tm-tools</tspan>
            </text>
          </g>
        </g>
      </svg>
      <span
        className={`absolute right-[16%] bottom-[9%] flex translate-y-2 items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-neutral-900 opacity-0 shadow-lg group-hover:translate-y-0 group-hover:opacity-100 ${move}`}
        style={{ ...delay(300), transitionProperty: "transform, opacity" }}
      >
        <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke={A} strokeWidth="2.4" aria-hidden>
          <path d="m3 8.5 3.2 3L13 4.5" />
        </svg>
        Copied
      </span>
    </Fill>
  ),

  mockup: () => (
    // Real renders from the tool: the phone's back tucked behind its front.
    // On hover the pair parts, like a product shot being set up.
    <Fill className="overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse 45% 75% at 50% 45%, ${soft(30)}, transparent 70%)` }}
      />
      <span className="absolute bottom-[6%] left-1/2 h-[7%] w-[36%] -translate-x-1/2 rounded-[50%] bg-black/40 blur-md" />
      <Image
        src="/home/mockup/iphone-back.webp"
        alt=""
        width={495}
        height={873}
        sizes="160px"
        className="absolute bottom-[10%] left-[33%] h-[76%] w-auto origin-bottom -rotate-6 drop-shadow-[0_16px_20px_rgb(0_0_0/0.35)] transition-transform duration-700 ease-out group-hover:-translate-x-[18%] group-hover:-rotate-12"
      />
      <Image
        src="/home/mockup/iphone.webp"
        alt=""
        width={478}
        height={900}
        sizes="160px"
        className="absolute right-[34%] bottom-[8%] h-[82%] w-auto drop-shadow-[0_20px_24px_rgb(0_0_0/0.4)] transition-transform duration-700 ease-out group-hover:translate-x-[14%] group-hover:-translate-y-[3%]"
      />
    </Fill>
  ),

  favicon: () => (
    // A favicon spec sheet: the mark living in a real tab, the same mark
    // magnified to its 16 px grid, and the files it ships as. On hover the
    // pixel grid comes up, the way you'd check it in a design tool.
    <Fill className="overflow-hidden">
      <svg viewBox="0 0 160 100" aria-hidden className="absolute inset-0 h-full w-full" fontFamily={`-apple-system, "Segoe UI", Helvetica, Arial, sans-serif`}>
        {/* Tab strip. */}
        <rect x="20" y="10" width="120" height="13" rx="2.5" fill="var(--muted)" />
        <path d="M24 23 v-7.5 a2 2 0 0 1 2 -2 h40 a2 2 0 0 1 2 2 v7.5 z" fill="var(--card)" stroke="var(--border)" strokeWidth="0.35" />
        <g transform="translate(28 16.2)">
          <PixelMark size={4.4} />
        </g>
        <text x="35" y="19.6" fontSize="3" fontWeight="500" fill="var(--foreground)">
          Northfold
        </text>
        <text x="63.5" y="19.7" fontSize="3" fill="var(--muted-foreground)">
          ×
        </text>
        <rect x="72" y="16.8" width="3.6" height="3.6" rx="0.8" fill="var(--muted-foreground)" opacity="0.35" />
        <rect x="78" y="17.9" width="18" height="1.4" rx="0.7" fill="var(--muted-foreground)" opacity="0.3" />

        {/* The mark at 16 × 16, magnified. */}
        <g transform="translate(24 32)">
          <PixelMark size={48} />
          <g className="opacity-0 transition-opacity duration-500 group-hover:opacity-100">
            {Array.from({ length: 17 }, (_, i) => (
              <g key={i}>
                <line x1={i * 3} y1="0" x2={i * 3} y2="48" stroke="var(--card)" strokeWidth="0.25" />
                <line x1="0" y1={i * 3} x2="48" y2={i * 3} stroke="var(--card)" strokeWidth="0.25" />
              </g>
            ))}
          </g>
          <text x="0" y="54" fontSize="2.6" fill="var(--muted-foreground)" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
            16 × 16 · 4× view
          </text>
        </g>

        {/* What ships. */}
        <g transform="translate(84 34)" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
          {[
            ["favicon.ico", "16 32 48"],
            ["icon.svg", "any"],
            ["apple-touch-icon.png", "180"],
            ["icon-512.png", "512"],
            ["site.webmanifest", "—"],
          ].map(([file, size], i) => (
            <g key={file} transform={`translate(0 ${i * 9})`}>
              <g className={`${move} group-hover:translate-x-[1.5px]`} style={delay(i * 40)}>
              <text x="0" y="3" fontSize="2.7" fill="var(--foreground)">
                {file}
              </text>
              <text x="52" y="3" fontSize="2.5" fill="var(--muted-foreground)" textAnchor="end">
                {size}
              </text>
              <line x1="0" y1="5.8" x2="52" y2="5.8" stroke="var(--border)" strokeWidth="0.3" />
              </g>
            </g>
          ))}
        </g>
      </svg>
    </Fill>
  ),

  logo: () => (
    // The same logo checked on every kind of background, with a verdict on each.
    <Fill className="flex flex-col gap-2 p-[6%]">
      <div className="grid flex-1 grid-cols-4 gap-1.5">
        {[
          { bg: "#ffffff", mark: A, label: "Light", ok: true },
          { bg: "#0a0a0a", mark: "#ffffff", label: "Dark", ok: true },
          {
            bg: soft(70, "#0a0a0a"),
            mark: "#ffffff",
            label: "Brand",
            ok: true,
          },
          { bg: "photo", mark: "#ffffff", label: "Busy", ok: false },
        ].map((tile, index) => (
          <div
            key={tile.label}
            className={`border-border/60 relative flex items-center justify-center overflow-hidden rounded-lg border ${move} group-hover:-translate-y-0.5`}
            style={{
              background: tile.bg === "photo" ? undefined : tile.bg,
              ...delay(index * 60),
            }}
          >
            {tile.bg === "photo" && <Photo className="absolute inset-0" />}
            <svg
              viewBox="0 0 24 24"
              className="relative size-[44%]"
              aria-hidden
            >
              <circle
                cx="12"
                cy="12"
                r="8"
                fill="none"
                stroke={tile.mark}
                strokeWidth="3"
              />
              <path
                d="M6.5 17.5 17.5 6.5"
                stroke={tile.mark}
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <span
              className={`absolute top-1 right-1 grid size-3 place-items-center rounded-full text-[6.5px] font-bold text-white ${tile.ok ? "" : "bg-amber-500"}`}
              style={tile.ok ? { background: A } : undefined}
            >
              {tile.ok ? "✓" : "!"}
            </span>
            <span
              className={`absolute bottom-0.5 text-[6.5px] font-medium ${index === 0 ? "text-neutral-500" : "text-white/75"}`}
            >
              {tile.label}
            </span>
          </div>
        ))}
      </div>

      {/* The report: a score and what it measured. */}
      <div className="bg-card border-border flex items-center gap-3 rounded-lg border px-2.5 py-1.5">
        <span
          className="font-heading text-[15px] leading-none font-bold"
          style={{ color: A }}
        >
          94
        </span>
        <div className="grid flex-1 grid-cols-3 gap-2">
          {[
            ["Contrast", 92],
            ["At 16px", 80],
            ["Shape", 96],
          ].map(([label, value], index) => (
            <div key={label as string} className="space-y-0.5">
              <span className="text-muted-foreground block text-[7px]">
                {label}
              </span>
              <span className="bg-foreground/10 block h-1 overflow-hidden rounded-full">
                <span
                  className="block h-full origin-left rounded-full transition-transform duration-700 ease-out [transform:scaleX(0.35)] group-hover:[transform:scaleX(1)]"
                  style={{
                    width: `${value}%`,
                    background: A,
                    ...delay(index * 80),
                  }}
                />
              </span>
            </div>
          ))}
        </div>
      </div>
    </Fill>
  ),

  codeshot: () => (
    <Center className="p-[8%]">
      <div
        className="absolute inset-[8%] rounded-2xl"
        style={{
          background: `linear-gradient(135deg, ${soft(70)}, ${soft(20)} 60%, transparent)`,
        }}
      />
      <div
        className={`relative w-[78%] rounded-xl border border-white/10 bg-neutral-950 p-3 shadow-2xl ${move} group-hover:-rotate-1 group-hover:scale-[1.03]`}
      >
        <div className="mb-2.5 flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-red-400" />
          <span className="size-2 rounded-full bg-amber-400" />
          <span className="size-2 rounded-full bg-emerald-400" />
          <span className="ml-2 font-mono text-[8px] text-white/40">
            ship.ts
          </span>
        </div>
        <div className="space-y-1 font-mono text-[9px] leading-tight">
          {[
            <>
              <span className="text-fuchsia-400">export const</span>{" "}
              <span className="text-sky-300">ship</span>{" "}
              <span className="text-white/50">= () =&gt;</span> {"{"}
            </>,
            <>
              {" "}
              <span className="text-fuchsia-400">return</span>{" "}
              <span className="text-emerald-300">&quot;done&quot;</span>;
            </>,
            <>{"}"}</>,
          ].map((line, index) => (
            <p key={index} className="whitespace-pre text-white/80">
              <span className="mr-2 text-white/25">{index + 1}</span>
              {line}
            </p>
          ))}
        </div>
      </div>
    </Center>
  ),

  logo3d: () => (
    // A monogram extruded for real: a stack of flat layers in 3D space, lit
    // flat like a matte render, on a soft contact shadow. On hover it turns
    // on the turntable.
    <Fill className="overflow-hidden">
      <span className="absolute bottom-[17%] left-1/2 h-[7%] w-[34%] -translate-x-1/2 rounded-[50%] bg-black/35 blur-md transition-transform duration-700 group-hover:scale-x-90" />
      <div className="absolute inset-0 flex items-center justify-center [perspective:700px]">
        <div className="relative size-[38%] max-w-32 transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d] [transform:rotateY(-32deg)_rotateX(14deg)] group-hover:[transform:rotateY(22deg)_rotateX(10deg)]">
          {Array.from({ length: 16 }, (_, i) => (
            <svg
              key={i}
              viewBox="0 0 100 100"
              className="absolute inset-0 size-full"
              style={{ transform: `translateZ(${-i * 1.4}px)` }}
              aria-hidden
            >
              <path d={MONOGRAM} fill={soft(i === 15 ? 30 : 46 - i, "#0a0a0b")} />
            </svg>
          ))}
          <svg viewBox="0 0 100 100" className="relative size-full" aria-hidden>
            <path d={MONOGRAM} fill={A} />
            <path d={MONOGRAM} fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="0.8" />
          </svg>
        </div>
      </div>
      <span className="text-muted-foreground absolute bottom-[7%] left-[7%] font-mono text-[9px] tracking-wide">
        extrude 24 · bevel 2 · matte
      </span>
    </Fill>
  ),

  ogstudio: () => (
    // Design the share image, then see it as the preview a link gets in a chat.
    <Center className="gap-3 px-[6%]">
      <div className="flex w-[44%] flex-col gap-1">
        <div
          className="relative flex aspect-[1.91/1] flex-col justify-end gap-1 overflow-hidden rounded-lg p-2 ring-1 ring-white/10"
          style={{
            background: `radial-gradient(circle at 85% 15%, ${soft(70)}, transparent 55%), linear-gradient(135deg, ${soft(60, "#0b0b0b")}, #0b0b0b)`,
          }}
        >
          <span className="font-heading text-[10px] leading-tight font-bold text-white">
            Launch day is here
          </span>
          <span className="h-[3px] w-1/2 rounded-full bg-white/45" />
          {/* Selection handles: this is the editor. */}
          <span className="absolute inset-1 rounded-md border border-dashed border-white/40" />
        </div>
        <span className="text-muted-foreground text-center font-mono text-[7.5px]">
          1200 × 630
        </span>
      </div>

      <span
        className={`text-sm ${move} group-hover:translate-x-1`}
        style={{ color: A }}
      >
        →
      </span>

      {/* How the link looks once it is shared. */}
      <div
        className={`bg-card border-border w-[42%] rounded-xl rounded-br-sm border p-1.5 shadow-md ${move} group-hover:-translate-y-1`}
      >
        <div
          className="flex aspect-[1.91/1] flex-col justify-end rounded-md p-1.5"
          style={{
            background: `radial-gradient(circle at 85% 15%, ${soft(70)}, transparent 55%), linear-gradient(135deg, ${soft(60, "#0b0b0b")}, #0b0b0b)`,
          }}
        >
          <span className="font-heading text-[7px] leading-tight font-bold text-white">
            Launch day is here
          </span>
        </div>
        <p className="mt-1 truncate px-0.5 text-[8px] font-semibold">
          Launch day is here
        </p>
        <p className="text-muted-foreground truncate px-0.5 font-mono text-[7px]">
          yoursite.com
        </p>
      </div>
    </Center>
  ),

  carousel: () => (
    <Center className="overflow-hidden">
      <div
        className={`flex gap-2 ${move} duration-700 group-hover:-translate-x-[88px]`}
      >
        {["Hook", "Tip 1", "Tip 2", "Follow"].map((label, index) => (
          <div
            key={label}
            className="flex aspect-[4/5] w-[84px] shrink-0 flex-col justify-between rounded-xl p-2.5 text-white"
            style={{
              background: `linear-gradient(160deg, ${soft(90 - index * 15, "#0b0b0b")}, #0b0b0b)`,
            }}
          >
            <span className="font-mono text-[8px] opacity-60">
              0{index + 1}/04
            </span>
            <span className="font-heading text-[12px] leading-tight font-bold">
              {label}
            </span>
            <span className="self-end text-[10px] opacity-70">→</span>
          </div>
        ))}
      </div>
    </Center>
  ),

  avatar: () => (
    // Avatars where they live: one picked out at full size with its file, and
    // the team row it belongs to. On hover the row fans out.
    <Fill className="overflow-hidden">
      <div className="absolute top-[18%] left-[9%] flex items-center gap-3">
        <Face person={PEOPLE[2]} className="size-16 ring-1 ring-[var(--border)]" />
        <div className="space-y-1.5">
          <p className="text-[12px] leading-none font-semibold">Lena Okafor</p>
          <p className="text-muted-foreground font-mono text-[9px] leading-none">lena.svg · 512 px</p>
        </div>
      </div>
      <div className="absolute top-[52%] left-[9%] flex items-center">
        {PEOPLE.map((p, i) => (
          <Face key={p.name} person={p} className={`size-10 ring-2 ring-[var(--card)] ${i ? "-ml-2.5" : ""} ${move} ${FAN[i]}`} style={delay(i * 40)} />
        ))}
        <span className={`bg-muted text-muted-foreground -ml-2.5 grid size-10 place-items-center rounded-full font-mono text-[10px] ring-2 ring-[var(--card)] ${move} ${FAN[5]}`} style={delay(200)}>
          +8
        </span>
      </div>
    </Fill>
  ),

  vectorforge: () => (
    <Center className="gap-4">
      {/* Raster in */}
      <div className="grid size-24 grid-cols-8 gap-px opacity-80">
        {Array.from({ length: 64 }, (_, index) => {
          const x = (index % 8) - 3.5;
          const y = Math.floor(index / 8) - 3.5;
          const inside = x * x + y * y < 12;
          return (
            <span
              key={index}
              className="aspect-square"
              style={{ background: inside ? A : "transparent" }}
            />
          );
        })}
      </div>
      <span
        className={`text-lg ${move} group-hover:translate-x-1`}
        style={{ color: A }}
      >
        →
      </span>
      {/* Vector out */}
      <svg viewBox="0 0 100 100" className="size-24" aria-hidden>
        <circle cx="50" cy="50" r="36" fill={A} />
        <circle
          cx="50"
          cy="50"
          r="36"
          fill="none"
          className="stroke-foreground"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        {[
          [50, 14],
          [86, 50],
          [50, 86],
          [14, 50],
        ].map(([x, y]) => (
          <rect
            key={`${x}-${y}`}
            x={x - 4}
            y={y - 4}
            width="8"
            height="8"
            rx="1.5"
            className="fill-card stroke-foreground"
            strokeWidth="1.5"
          />
        ))}
      </svg>
    </Center>
  ),

  appshots: () => (
    // A store listing: captioned screenshots with the phone bleeding off the
    // bottom, the set running off the edge like the real carousel. On hover
    // it scrolls along.
    <Fill className="overflow-hidden">
      <div className={`absolute top-[10%] bottom-0 left-[8%] flex gap-[3%] ${move} duration-700 group-hover:-translate-x-[14%]`} style={{ width: "120%" }}>
        {[
          { title: "Your week,\nat a glance", hero: true },
          { title: "Share a plan\nin one tap", hero: false },
          { title: "Never miss\nwhat matters", hero: false },
        ].map((panel) => (
          <div
            key={panel.title}
            className={`relative flex w-[27%] shrink-0 flex-col overflow-hidden rounded-t-xl px-[4%] pt-[5%] ${panel.hero ? "text-white" : "bg-muted text-foreground"}`}
            style={panel.hero ? { background: A } : undefined}
          >
            <p className="font-heading text-[10px] leading-[1.15] font-semibold tracking-tight whitespace-pre-line">{panel.title}</p>
            <div className="mt-[10%] flex-1 rounded-t-[12px] border-[3px] border-b-0 border-neutral-900 bg-neutral-900">
              <PhoneScreen />
            </div>
          </div>
        ))}
      </div>
    </Fill>
  ),

  loop: () => (
    <Center>
      <div className="border-border relative aspect-video w-[70%] overflow-hidden rounded-xl border bg-neutral-950">
        <span
          className="absolute top-1/2 left-[15%] size-10 -translate-y-1/2 rounded-full transition-[left] duration-[1200ms] ease-in-out group-hover:left-[65%]"
          style={{ background: A, boxShadow: `0 0 30px ${soft(60)}` }}
        />
        <span
          className="absolute top-1/2 left-[15%] size-10 -translate-y-1/2 rounded-full opacity-30"
          style={{ background: A }}
        />
        <div className="absolute inset-x-2 bottom-2 flex items-center gap-2">
          <span className="text-[9px] text-white/70">↻</span>
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
            <span
              className="block h-full w-1/4 rounded-full transition-[width] duration-[1200ms] ease-in-out group-hover:w-full"
              style={{ background: A }}
            />
          </span>
          <span className="font-mono text-[8px] text-white/60">MP4</span>
        </div>
      </div>
    </Center>
  ),

  /* ============================================================= links */

  whatsapp: () => (
    <Fill className="flex flex-col items-center justify-center gap-2.5 px-[10%]">
      <span className="bg-card border-border flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[9px]">
        <WhatsAppIcon className="size-3 shrink-0 text-[#25D366]" />
        <span className="truncate">wa.me/351912…?text=Hi!</span>
      </span>
      <Win bar={false} className="w-full max-w-[15rem]">
        <div className="border-border/70 flex items-center gap-2 border-b px-2.5 py-1.5">
          <span
            className="relative size-4 rounded-full"
            style={{ background: soft(45) }}
          >
            <WhatsAppIcon className="absolute -right-1 -bottom-1 size-2.5 rounded-full bg-card text-[#25D366]" />
          </span>
          <span className="text-[9px] font-medium">Casa Verde</span>
          <span className="ml-auto text-[8px]" style={{ color: A }}>
            online
          </span>
        </div>
        <div className="flex flex-col gap-1.5 p-2.5">
          <span
            className={`self-end rounded-xl rounded-br-sm px-2.5 py-1.5 text-[9px] text-white ${move} group-hover:-translate-y-0.5`}
            style={{ background: A }}
          >
            Hi! A table for two on Friday? ✓✓
          </span>
          <span className="bg-muted self-start rounded-xl rounded-bl-sm px-2.5 py-1.5 text-[9px] opacity-0 transition-opacity delay-300 duration-500 group-hover:opacity-100">
            Booked, see you at 8!
          </span>
        </div>
      </Win>
    </Fill>
  ),

  qr: () => (
    <Center>
      <div className="relative rounded-2xl bg-white p-3 shadow-lg">
        <MiniCode size={92} seed={11} color="#0a0a0a" />
        {/* Phone camera framing the code. */}
        {[
          "top-0 left-0 border-t-2 border-l-2",
          "top-0 right-0 border-t-2 border-r-2",
          "bottom-0 left-0 border-b-2 border-l-2",
          "right-0 bottom-0 border-r-2 border-b-2",
        ].map((corner) => (
          <span
            key={corner}
            className={`absolute size-5 rounded-[4px] transition-all duration-500 group-hover:m-[-6px] ${corner}`}
            style={{ borderColor: A }}
          />
        ))}
        <span
          className="absolute -right-3 -bottom-3 grid size-7 scale-0 place-items-center rounded-full text-xs text-white shadow-md transition-transform delay-300 duration-300 group-hover:scale-100"
          style={{ background: A }}
        >
          ✓
        </span>
      </div>
    </Center>
  ),

  share: () => (
    <Center>
      <svg
        viewBox="0 0 320 200"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        {[
          [236, 50],
          [262, 100],
          [236, 150],
          [190, 168],
        ].map(([x, y], index) => (
          <path
            key={index}
            d={`M150 100L${x} ${y}`}
            stroke={A}
            strokeWidth="1.5"
            strokeDasharray="3 4"
            opacity="0.5"
          />
        ))}
      </svg>
      <span className="bg-card border-border absolute top-1/2 left-[14%] flex -translate-y-1/2 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[9px]">
        <span style={{ color: A }}>↗</span> yoursite.com
      </span>
      {[
        { label: "X", top: "25%", left: "73.75%", bg: "#0a0a0a" },
        { label: "in", top: "50%", left: "81.9%", bg: "#0a66c2" },
        { label: "f", top: "75%", left: "73.75%", bg: "#1877f2" },
        { label: "✈", top: "84%", left: "59.4%", bg: "#229ed9" },
      ].map((app, index) => (
        <span
          key={app.label}
          className={`absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[11px] font-bold text-white shadow-md ${move} group-hover:scale-110`}
          style={{
            top: app.top,
            left: app.left,
            background: app.bg,
            ...delay(index * 60),
          }}
        >
          {app.label}
        </span>
      ))}
    </Center>
  ),

  vcard: () => (
    <Center>
      <div
        className={`border-border bg-card relative flex w-[72%] items-center gap-3 rounded-2xl border p-3 shadow-lg ${move} group-hover:-rotate-2`}
      >
        <span
          className="size-11 shrink-0 rounded-full"
          style={{ background: `linear-gradient(135deg, ${A}, ${soft(30)})` }}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-heading text-[11px] leading-none font-bold">
            Ana Duarte
          </p>
          <p className="text-muted-foreground text-[9px]">Designer · Porto</p>
          <p className="text-muted-foreground font-mono text-[8px]">
            ana@studio.pt
          </p>
        </div>
        <div className="rounded-md bg-white p-1">
          <MiniCode size={38} cells={13} seed={5} color="#0a0a0a" />
        </div>
      </div>
    </Center>
  ),

  utm: () => (
    <Fill className="flex flex-col justify-center gap-3 px-[7%]">
      <div className="bg-card border-border rounded-xl border px-3 py-2 font-mono text-[9px] leading-relaxed break-all">
        <span className="text-muted-foreground">shop.com/sale?</span>
        <span
          className="rounded px-0.5"
          style={{ background: soft(25), color: A }}
        >
          utm_source=newsletter
        </span>
        &amp;
        <span className="rounded px-0.5" style={{ background: soft(15) }}>
          utm_medium=email
        </span>
      </div>
      <div className="flex h-12 items-end gap-1.5 px-1">
        {[30, 45, 38, 60, 52, 80, 95].map((height, index) => (
          <span
            key={index}
            className="flex-1 origin-bottom rounded-t-sm transition-transform duration-500 group-hover:scale-y-110"
            style={{
              height: `${height}%`,
              background: index === 6 ? A : soft(30),
              ...delay(index * 40),
            }}
          />
        ))}
      </div>
    </Fill>
  ),

  barcode: () => (
    <Center>
      <div className="relative overflow-hidden rounded-lg bg-white px-4 pt-3 pb-2 shadow-lg">
        <div className="flex h-14 items-stretch gap-[1.5px]">
          {Array.from({ length: 38 }, (_, index) => {
            const random = seeded(index + 9);
            return (
              <span
                key={index}
                className="bg-neutral-900"
                style={{ width: 1 + Math.floor(random() * 3) }}
              />
            );
          })}
        </div>
        <p className="mt-1 text-center font-mono text-[9px] tracking-[0.2em] text-neutral-700">
          5901234123457
        </p>
        <span
          className="absolute inset-x-0 top-3 h-[2px] opacity-0 shadow-[0_0_8px_currentColor] transition-all duration-700 group-hover:top-16 group-hover:opacity-100"
          style={{ background: A, color: A }}
        />
      </div>
    </Center>
  ),

  /* ============================================================= image */

  bgremover: () => (
    <Fill>
      <div className="absolute inset-y-0 left-0 w-1/2 bg-[linear-gradient(160deg,#fed7aa,#fb923c)] transition-[width] duration-700 ease-out group-hover:w-[22%]" />
      <div
        className={`absolute inset-y-0 right-0 left-1/2 transition-[left] duration-700 ease-out group-hover:left-[22%] ${CHECKER}`}
      />
      <span className="absolute inset-y-0 left-1/2 w-0.5 bg-white transition-[left] duration-700 ease-out group-hover:left-[22%]" />
      <Center>
        <svg viewBox="0 0 120 120" className="h-[64%]" aria-hidden>
          <path
            d="M34 34h44v40c0 10-8 18-18 18h-8c-10 0-18-8-18-18Z"
            fill={A}
          />
          <path
            d="M78 44h6c7 0 12 5 12 11s-5 12-12 12h-6v-7h6c3 0 5-2 5-5s-2-4-5-4h-6Z"
            fill={A}
          />
          <path
            d="M42 42v34"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.35"
          />
          <path
            d="M30 98h64"
            stroke="#7c2d12"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.25"
            className="transition-opacity duration-500 group-hover:opacity-0"
          />
        </svg>
      </Center>
    </Fill>
  ),

  imagesplitter: () => (
    <Center>
      <div className="grid aspect-square h-[72%] grid-cols-3 gap-[2px] transition-[gap] duration-500 group-hover:gap-2">
        {Array.from({ length: 9 }, (_, index) => (
          <div key={index} className="relative overflow-hidden rounded-[3px]">
            <Photo
              className="absolute h-[300%] w-[300%]"
              style={{
                left: `${-(index % 3) * 100}%`,
                top: `${-Math.floor(index / 3) * 100}%`,
              }}
            />
          </div>
        ))}
      </div>
    </Center>
  ),

  photofx: () => (
    <Center>
      <div className="relative aspect-[4/3] h-[72%] overflow-hidden rounded-xl">
        <Photo className="absolute inset-0" />
        {/* Duotone halftone, wiping across on hover. */}
        <div
          className="absolute inset-y-0 right-0 w-1/2 transition-[width] duration-700 ease-out group-hover:w-full"
          style={{
            background: `radial-gradient(circle, #0b0b0b 1.6px, transparent 1.8px) 0 0 / 7px 7px, ${A}`,
          }}
        />
        <span className="absolute inset-y-0 right-1/2 w-0.5 bg-white transition-[right] duration-700 ease-out group-hover:right-full" />
      </div>
    </Center>
  ),

  enhancer: () => (
    <Center className="gap-3">
      <div className="bg-card border-border w-[34%] rounded-xl border p-2">
        <Photo className="aspect-[4/3] rounded-md" />
        <div className="mt-1.5 flex justify-between font-mono text-[8px]">
          <span>photo.png</span>
          <span className="text-muted-foreground">2.4 MB</span>
        </div>
      </div>
      <span
        className={`text-lg ${move} group-hover:translate-x-1`}
        style={{ color: A }}
      >
        →
      </span>
      <div
        className="w-[34%] rounded-xl border p-2"
        style={{ borderColor: soft(50), background: soft(8) }}
      >
        <Photo className="aspect-[4/3] rounded-md" />
        <div className="mt-1.5 flex justify-between font-mono text-[8px]">
          <span style={{ color: A }} className="font-semibold">
            photo.webp
          </span>
          <span style={{ color: A }}>310 KB</span>
        </div>
      </div>
    </Center>
  ),

  attention: () => (
    <Center>
      <Win className="relative w-[66%]">
        <div className="space-y-2 p-3">
          <Bar w="55%" strong className="h-2.5" />
          <Bar w="80%" />
          <div className="flex gap-2">
            <span className="aspect-video w-1/2 rounded-md bg-foreground/10" />
            <div className="flex-1 space-y-1.5">
              <Bar w="90%" />
              <Bar w="70%" />
              <span
                className="mt-2 block h-4 w-3/4 rounded-full"
                style={{ background: A }}
              />
            </div>
          </div>
        </div>
        <span
          className="absolute top-3 left-4 size-16 rounded-full bg-[radial-gradient(circle,rgb(239_68_68/0.75),rgb(245_158_11/0.4)_45%,transparent_70%)] transition-opacity duration-500 group-hover:opacity-100"
          style={{ opacity: 0.85 }}
        />
        <span className="absolute right-6 bottom-2 size-12 rounded-full bg-[radial-gradient(circle,rgb(239_68_68/0.7),rgb(245_158_11/0.35)_45%,transparent_70%)] opacity-0 transition-opacity delay-200 duration-500 group-hover:opacity-100" />
      </Win>
    </Center>
  ),

  /* ============================================================= color */

  palette: () => (
    <Fill className="flex items-stretch gap-1.5 p-[7%]">
      {[92, 74, 55, 34, 16].map((amount, index) => (
        <div
          key={amount}
          className={`flex flex-1 flex-col justify-end rounded-xl p-1.5 transition-[flex-grow] duration-500 ${index === 2 ? "group-hover:flex-[1.8]" : ""}`}
          style={{ background: soft(amount, index > 2 ? "white" : "#0b0b0b") }}
        >
          <span
            className={`font-mono text-[7px] ${index > 2 ? "text-neutral-800" : "text-white/80"}`}
          >
            {["900", "700", "500", "300", "100"][index]}
          </span>
        </div>
      ))}
    </Fill>
  ),

  pantone: () => (
    <Center>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="absolute flex aspect-[3/4] h-[70%] origin-bottom flex-col overflow-hidden rounded-md bg-white shadow-xl transition-transform duration-500 ease-out"
          style={{
            transform: `rotate(${(index - 1) * 10}deg)`,
            zIndex: index === 1 ? 2 : 1,
          }}
        >
          <div
            className="flex-[3]"
            style={{
              background: soft(
                100 - index * 25,
                index === 2 ? "white" : "#111",
              ),
            }}
          />
          <div className="flex-1 px-1.5 py-1 text-[6px] leading-tight text-neutral-900">
            <b className="block">PANTONE®</b>
            <span className="text-neutral-500">
              {["16-5422", "17-5641", "13-5409"][index]} TCX
            </span>
          </div>
        </div>
      ))}
    </Center>
  ),

  colors: () => (
    <Center className="gap-3">
      <div className="relative aspect-[4/5] h-[72%] overflow-hidden rounded-xl">
        <Photo className="absolute inset-0" />
        {[
          ["24%", "30%"],
          ["70%", "30%"],
          ["40%", "78%"],
        ].map(([left, top], index) => (
          <span
            key={index}
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow transition-transform duration-500 group-hover:scale-125"
            style={{ left, top, ...delay(index * 80) }}
          />
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {["#FDE68A", "#FCD34D", "#047857", "#022C22"].map((hex, index) => (
          <div
            key={hex}
            className={`flex items-center gap-1.5 ${move} group-hover:translate-x-1`}
            style={delay(index * 60)}
          >
            <span className="size-5 rounded-md" style={{ background: hex }} />
            <span className="font-mono text-[8px]">{hex}</span>
          </div>
        ))}
      </div>
    </Center>
  ),

  contrast: () => (
    <Fill className="flex flex-col justify-center gap-2 px-[12%]">
      <div
        className="flex items-center justify-between rounded-xl px-3 py-2.5"
        style={{ background: A }}
      >
        <span className="font-heading text-xl font-bold text-black">Aa</span>
        <span className="rounded-full bg-black/80 px-2 py-0.5 font-mono text-[8px] text-white">
          8.1 · AAA ✓
        </span>
      </div>
      <div
        className="flex items-center justify-between rounded-xl px-3 py-2.5"
        style={{ background: soft(40) }}
      >
        <span
          className="font-heading text-xl font-bold"
          style={{ color: soft(70) }}
        >
          Aa
        </span>
        <span className="rounded-full bg-red-500/90 px-2 py-0.5 font-mono text-[8px] text-white">
          1.8 · Fail
        </span>
      </div>
    </Fill>
  ),

  /* ======================================================= backgrounds */

  mesh: () => (
    <Fill className="overflow-hidden">
      <div
        className="absolute inset-[-25%] blur-2xl transition-transform duration-1000 ease-out group-hover:rotate-[20deg]"
        style={{
          background: `radial-gradient(circle at 28% 32%, ${soft(95)}, transparent 42%), radial-gradient(circle at 74% 30%, #f472b6, transparent 40%), radial-gradient(circle at 56% 82%, #60a5fa, transparent 45%)`,
        }}
      />
      {[
        ["28%", "32%"],
        ["74%", "30%"],
        ["56%", "78%"],
      ].map(([left, top]) => (
        <span
          key={left}
          className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/30 shadow"
          style={{ left, top }}
        />
      ))}
    </Fill>
  ),

  pattern: () => (
    <Fill>
      <div
        className="absolute inset-0 bg-[length:28px_28px] transition-[background-size] duration-700 group-hover:bg-[length:36px_36px]"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, ${A} 3px, transparent 3.5px), linear-gradient(45deg, transparent 47%, ${soft(30)} 47% 53%, transparent 53%), linear-gradient(-45deg, transparent 47%, ${soft(18)} 47% 53%, transparent 53%)`,
        }}
      />
      <span className="absolute top-1/2 left-1/2 size-[56px] -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-dashed border-white/80 bg-black/20 backdrop-blur-[1px] transition-all duration-700 group-hover:size-[72px]" />
    </Fill>
  ),

  clippath: () => (
    <Center>
      <div className="relative aspect-square h-[78%]">
        <Photo className="absolute inset-0 transition-[clip-path] duration-700 ease-out [clip-path:polygon(50%_0,100%_38%,82%_100%,18%_100%,0_38%)] group-hover:[clip-path:polygon(50%_6%,94%_50%,50%_94%,6%_50%,50%_6%)]" />
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          <polygon
            points="50,0 100,38 82,100 18,100 0,38"
            fill="none"
            stroke={A}
            strokeWidth="1"
            strokeDasharray="3 2"
            className="transition-opacity duration-500 group-hover:opacity-0"
          />
          {[
            [50, 0],
            [100, 38],
            [82, 100],
            [18, 100],
            [0, 38],
          ].map(([x, y]) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r="3.5"
              className="fill-card transition-opacity duration-500 group-hover:opacity-0"
              stroke={A}
              strokeWidth="1.5"
            />
          ))}
        </svg>
      </div>
    </Center>
  ),

  gradient: () => (
    <Fill className="flex items-center gap-4 px-[8%]">
      <div className="flex flex-1 flex-col gap-3">
        <div
          className="h-16 rounded-xl"
          style={{
            background: `linear-gradient(90deg, ${A}, #f472b6, #facc15)`,
          }}
        />
        <div className="relative h-3">
          {[0, 50, 100].map((left, index) => (
            <span
              key={left}
              className={`absolute top-0 size-3 -translate-x-1/2 rotate-45 rounded-[2px] border-2 border-white shadow ${move} group-hover:-translate-y-1`}
              style={{
                left: `${left}%`,
                background: [A, "#f472b6", "#facc15"][index],
              }}
            />
          ))}
        </div>
      </div>
      <div className="relative size-14 rounded-full border-2 border-dashed border-foreground/25">
        <span
          className="absolute top-1/2 left-1/2 h-[2px] w-1/2 origin-left rotate-[-35deg] transition-transform duration-700 group-hover:rotate-[45deg]"
          style={{ background: A }}
        />
        <span className="text-muted-foreground absolute -bottom-4 left-1/2 -translate-x-1/2 font-mono text-[8px]">
          90°
        </span>
      </div>
    </Fill>
  ),

  blob: () => (
    <Fill>
      <svg
        viewBox="0 0 320 200"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <path
          d="M160 34c42 0 74 28 66 64s-36 56-72 54-64-30-60-64 24-54 66-54Z"
          fill={soft(70)}
          className="transition-[d] duration-700 group-hover:[d:path('M168_40c36_6_66_34_56_68s-42_48-76_44-58-34-52-66_36-52_72-46Z')]"
        />
        <path
          d="M0 162c40-18 80-18 120 0s80 18 120 0 60-18 80-8v46H0Z"
          fill={A}
          opacity="0.85"
        />
        <path
          d="M0 178c40-12 80-12 120 0s80 12 120 0 60-12 80-6v28H0Z"
          fill={A}
        />
      </svg>
    </Fill>
  ),

  /* =============================================================== css */

  grid: () => (
    <Fill className="grid grid-cols-[1fr_2.2fr] grid-rows-[auto_1fr_auto] gap-1.5 p-[7%] font-mono text-[8px] transition-[gap] duration-500 group-hover:gap-3">
      {[
        ["header", "col-span-2 h-7", 40],
        ["nav", "", 12],
        ["main", "", 22],
        ["footer", "col-span-2 h-6", 28],
      ].map(([label, span, amount]) => (
        <span
          key={label as string}
          className={`flex items-center justify-center rounded-md border border-dashed ${span}`}
          style={{
            borderColor: soft(65),
            background: soft(amount as number),
            color: A,
          }}
        >
          {label}
        </span>
      ))}
    </Fill>
  ),

  glass: () => (
    <Center>
      <span
        className="absolute top-[14%] left-[26%] size-24 rounded-full transition-transform duration-700 group-hover:translate-x-4"
        style={{ background: A }}
      />
      <span className="absolute right-[24%] bottom-[10%] size-20 rounded-full bg-pink-400 transition-transform duration-700 group-hover:-translate-x-4" />
      <div className="relative h-[58%] w-[58%] rounded-2xl border border-white/30 bg-white/10 p-3 shadow-xl backdrop-blur-md">
        <span className="block h-2 w-16 rounded-full bg-white/80" />
        <span className="mt-1.5 block h-2 w-10 rounded-full bg-white/45" />
        <span className="absolute right-3 bottom-3 rounded-full border border-white/40 bg-white/20 px-2 py-0.5 text-[8px] text-white">
          blur 16px
        </span>
      </div>
    </Center>
  ),

  materialforge: () => (
    <Center className="gap-3">
      {[
        `radial-gradient(circle at 32% 28%, white 0 6%, ${soft(95)} 22%, ${soft(55, "#000")} 60%, #000 100%)`,
        "radial-gradient(circle at 32% 28%, white 0 6%, #fde68a 20%, #b45309 60%, #1c0a00 100%)",
        "radial-gradient(circle at 32% 28%, white 0 8%, #d4d4d8 25%, #52525b 60%, #09090b 100%)",
      ].map((background, index) => (
        <span
          key={index}
          className={`aspect-square rounded-full shadow-2xl transition-transform duration-700 ${index === 0 ? "h-[58%] group-hover:scale-105 group-hover:rotate-45" : "h-[30%] group-hover:-translate-y-1"}`}
          style={{ background, ...delay(index * 80) }}
        />
      ))}
    </Center>
  ),

  shadow: () => (
    <Center>
      <span className="absolute top-[12%] left-[16%] text-lg transition-transform duration-700 group-hover:translate-x-24">
        ☀
      </span>
      <div
        className="bg-card border-border h-[52%] w-[44%] rounded-2xl border transition-shadow duration-700 [box-shadow:18px_22px_30px_-8px_var(--shadow-tone),40px_50px_60px_-24px_var(--shadow-tone)] group-hover:[box-shadow:-18px_22px_30px_-8px_var(--shadow-tone),-40px_50px_60px_-24px_var(--shadow-tone)]"
        style={{ "--shadow-tone": soft(55, "#000") } as CSSProperties}
      />
    </Center>
  ),

  transform3d: () => (
    <Center className="[perspective:500px]">
      <svg
        viewBox="0 0 120 120"
        className="absolute size-36 opacity-40"
        aria-hidden
      >
        <path
          d="M60 60H112M60 60V8M60 60L24 96"
          className="stroke-foreground"
          strokeWidth="1"
        />
        <text x="114" y="63" fontSize="8" className="fill-foreground font-mono">
          x
        </text>
        <text x="58" y="6" fontSize="8" className="fill-foreground font-mono">
          y
        </text>
        <text x="18" y="104" fontSize="8" className="fill-foreground font-mono">
          z
        </text>
      </svg>
      <div
        className="relative grid h-[48%] w-[38%] place-items-center rounded-xl border-2 transition-transform duration-700 [transform:rotateX(42deg)_rotateY(-24deg)] group-hover:[transform:rotateX(10deg)_rotateY(18deg)]"
        style={{ borderColor: A, background: soft(22) }}
      >
        <span className="font-mono text-[9px]" style={{ color: A }}>
          rotateX
        </span>
      </div>
    </Center>
  ),

  easing: () => (
    <Fill>
      <svg
        viewBox="0 0 320 200"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <path
          d="M70 160H250M70 160V40"
          className="stroke-foreground"
          opacity="0.2"
        />
        <path
          d="M70 160L150 160M250 40L120 40"
          className="stroke-foreground"
          opacity="0.3"
          strokeDasharray="3 3"
        />
        <path
          d="M70 160C150 160 120 40 250 40"
          fill="none"
          stroke={A}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="150" cy="160" r="6" className="fill-foreground" />
        <circle cx="120" cy="40" r="6" className="fill-foreground" />
        <circle
          cx="70"
          cy="160"
          r="9"
          fill={A}
          className="transition-transform duration-[1000ms] [transition-timing-function:cubic-bezier(.7,0,.3,1)] group-hover:translate-x-[180px] group-hover:-translate-y-[120px]"
        />
      </svg>
      <span className="text-muted-foreground absolute right-[8%] bottom-[8%] font-mono text-[8px]">
        cubic-bezier(.7,0,.3,1)
      </span>
    </Fill>
  ),

  glow: () => (
    <Center>
      <div className="relative h-[54%] w-[60%] overflow-hidden rounded-2xl p-[2px]">
        <span
          className="absolute inset-[-80%] animate-[spin_4s_linear_infinite] [animation-play-state:paused] group-hover:[animation-play-state:running]"
          style={{
            background: `conic-gradient(from 0deg, transparent 55%, ${A}, white, ${A}, transparent 85%)`,
          }}
        />
        <div className="bg-card relative flex h-full w-full flex-col justify-center gap-1.5 rounded-[14px] px-4">
          <Bar w="50%" strong />
          <Bar w="75%" />
        </div>
      </div>
    </Center>
  ),

  /* ============================================================== type */

  markdown: () => (
    <Center className="gap-2.5 px-[6%]">
      <div className="bg-card border-border flex-1 space-y-1 rounded-xl border p-2.5 font-mono text-[8.5px] leading-snug text-muted-foreground">
        <p>
          <span style={{ color: A }}>#</span> Release notes
        </p>
        <p>
          <span style={{ color: A }}>**</span>Faster
          <span style={{ color: A }}>**</span> exports
        </p>
        <p>
          <span style={{ color: A }}>-</span> Dark mode
        </p>
        <p>
          <span style={{ color: A }}>-</span> [x] Tables
        </p>
      </div>
      <span
        className={move + " group-hover:translate-x-1"}
        style={{ color: A }}
      >
        →
      </span>
      <div className="bg-card border-border flex-1 space-y-1 rounded-xl border p-2.5">
        <p className="font-heading text-[12px] leading-none font-bold">
          Release notes
        </p>
        <p className="text-[8.5px]">
          <b>Faster</b> exports
        </p>
        <p className="text-[8.5px]">• Dark mode</p>
        <p className="text-[8.5px]">☑ Tables</p>
      </div>
    </Center>
  ),

  lorem: () => (
    <Center>
      <div className="bg-card border-border relative w-[64%] rounded-xl border p-3 shadow-lg">
        <p className="font-heading text-[12px] font-bold">Lorem ipsum dolor</p>
        <p className="text-muted-foreground mt-1 line-clamp-3 font-serif text-[8.5px] leading-relaxed">
          Sit amet, consectetur adipiscing elit, sed do eiusmod tempor
          incididunt ut labore et dolore magna aliqua enim.
        </p>
        <span
          className={`absolute -top-2.5 -right-2.5 rounded-full px-2 py-0.5 font-mono text-[8px] text-white shadow ${move} group-hover:scale-110`}
          style={{ background: A }}
        >
          120 words
        </span>
      </div>
    </Center>
  ),

  fluid: () => (
    <Fill className="flex items-end justify-center gap-3 px-[6%] pb-[8%]">
      {[
        { w: "w-[16%]", h: "h-[62%]", text: "text-[13px]" },
        { w: "w-[26%]", h: "h-[56%]", text: "text-[19px]" },
        { w: "w-[40%]", h: "h-[52%]", text: "text-[28px]" },
      ].map((frame, index) => (
        <div
          key={index}
          className={`border-border bg-card flex flex-col items-center justify-center gap-1 rounded-lg border ${frame.w} ${frame.h}`}
        >
          <span
            className={`font-heading leading-none font-bold transition-colors duration-500 ${frame.text}`}
            style={index === 2 ? { color: A } : undefined}
          >
            Aa
          </span>
          <span className="h-1 w-1/2 rounded-full bg-foreground/15" />
        </div>
      ))}
    </Fill>
  ),

  fontmaker: () => (
    // Handwriting on the guides in, an installable font file out.
    <Center className="gap-4 px-[7%]">
      <div className="bg-card border-border relative aspect-square w-[34%] max-w-32 overflow-hidden rounded-xl border">
        <span className="border-border absolute inset-x-0 top-[22%] border-t border-dashed" />
        <span className="border-border absolute inset-x-0 top-[42%] border-t border-dashed" />
        <span className="absolute inset-x-0 top-[74%] border-t" style={{ borderColor: A }} />
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 74 L31 24 L48 74 M21 55 Q31 52 42 54" />
          <path d="M84 50 Q70 40 62 54 Q57 72 71 73 Q81 72 84 54 L86 70 Q88 76 94 71" />
        </svg>
      </div>

      <span className={`text-sm ${move} group-hover:translate-x-1`} style={{ color: A }}>
        →
      </span>

      <div className="flex w-[44%] flex-col gap-1.5">
        <div className="bg-card border-border flex items-center gap-2.5 rounded-xl border p-2 shadow-sm">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white" style={{ background: A }}>
            Aa
          </span>
          <span className="min-w-0">
            <span className="block truncate font-mono text-[9px] font-semibold">hand.ttf</span>
            <span className="text-muted-foreground block font-mono text-[7.5px]">82 glyphs · kerned</span>
          </span>
        </div>
        <span
          className={`self-start rounded-full px-2 py-0.5 text-[8px] font-semibold text-white opacity-0 ${move} translate-y-1 transition-opacity group-hover:translate-y-0 group-hover:opacity-100`}
          style={{ background: A }}
        >
          ✓ Installed
        </span>
      </div>
    </Center>
  ),

  typography: () => (
    <Center className="flex-col gap-1">
      <span
        className="font-heading bg-clip-text text-5xl font-black tracking-tight text-transparent transition-[background-position] duration-1000 [background-size:200%_100%] group-hover:[background-position:100%_0]"
        style={{
          backgroundImage: `linear-gradient(90deg, ${A}, #f472b6, #facc15, ${A})`,
        }}
      >
        Vivid
      </span>
      <span
        className="font-heading text-2xl font-bold tracking-tight"
        style={{ color: "transparent", WebkitTextStroke: `1px ${A}` }}
      >
        Outline
      </span>
    </Center>
  ),

  /* ========================================================= brand lab */

  foundry: () => (
    <Center className="gap-4">
      <div className="flex flex-col gap-1">
        {[95, 75, 55, 35, 15].map((amount, index) => (
          <span
            key={amount}
            className={`h-3.5 w-16 rounded-md ${move} group-hover:translate-x-1`}
            style={{
              background: soft(amount, index > 2 ? "white" : "#0b0b0b"),
              ...delay(index * 40),
            }}
          />
        ))}
      </div>
      <div className="bg-card border-border space-y-2 rounded-xl border p-3">
        <p className="font-heading text-xl leading-none font-bold">Aa</p>
        <span
          className="block rounded-full px-3 py-1 text-[9px] font-semibold text-white"
          style={{ background: A }}
        >
          Primary
        </span>
        <span
          className="block rounded-full border px-3 py-1 text-[9px] font-semibold"
          style={{ borderColor: A, color: A }}
        >
          Outline
        </span>
      </div>
    </Center>
  ),

  dna: () => (
    // Paste a site's address, get its design system back as tokens.
    <Fill className="flex flex-col justify-center gap-2 px-[7%]">
      <div className="bg-card border-border flex items-center gap-2 rounded-full border py-1 pr-1 pl-3">
        <span className="text-muted-foreground font-mono text-[9px]">
          https://
        </span>
        <span className="font-mono text-[9px]">stripe.com</span>
        <span
          className="ml-auto rounded-full px-2.5 py-1 text-[8px] font-semibold text-white"
          style={{ background: A }}
        >
          Extract
        </span>
      </div>
      <div className="bg-card border-border grid grid-cols-[1.4fr_1fr_1fr] gap-2 rounded-xl border p-2.5">
        <div className="space-y-1">
          <span className="text-muted-foreground block text-[7px]">Colors</span>
          <div className="flex gap-1">
            {["#635bff", "#0a2540", "#00d4ff", "#f6f9fc"].map((hex, index) => (
              <span
                key={hex}
                className={`border-border/60 size-5 rounded-md border ${move} group-hover:-translate-y-0.5`}
                style={{ background: hex, ...delay(index * 50) }}
              />
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-muted-foreground block text-[7px]">Type</span>
          <span className="font-heading block text-[15px] leading-none font-semibold">
            Aa
          </span>
          <span className="text-muted-foreground block font-mono text-[7px]">
            Sohne · 600
          </span>
        </div>
        <div className="space-y-1">
          <span className="text-muted-foreground block text-[7px]">
            Radius · Space
          </span>
          <span
            className="block h-4 w-8 rounded-md border-2"
            style={{ borderColor: A }}
          />
          <span className="flex items-end gap-0.5">
            {[3, 5, 8, 12].map((h) => (
              <span
                key={h}
                className="w-1 rounded-sm"
                style={{ height: h, background: soft(60) }}
              />
            ))}
          </span>
        </div>
      </div>
      <span
        className="self-start rounded-md px-1.5 py-0.5 font-mono text-[7.5px]"
        style={{ background: soft(14), color: A }}
      >
        --brand: #635bff;
      </span>
    </Fill>
  ),

  /* ========================================================= utilities */

  password: () => (
    // A generated password, the rules it follows and how strong it is.
    <Fill className="flex flex-col justify-center gap-2 px-[9%]">
      <div className="bg-card border-border flex items-center gap-2 rounded-xl border px-3 py-2.5">
        <span className="font-mono text-[12px] tracking-wider">
          x7<span style={{ color: A }}>#</span>Qp
          <span style={{ color: A }}>!</span>m2Rw
          <span style={{ color: A }}>$</span>9Lk
        </span>
        <span
          className={`text-muted-foreground ml-auto text-[11px] transition-transform duration-500 group-hover:rotate-180`}
        >
          ↻
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: A, opacity: 0.45 + index * 0.18 }}
          />
        ))}
        <span className="ml-1 text-[9px] font-semibold" style={{ color: A }}>
          Strong · 98 bits
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {["A–Z", "a–z", "0–9", "#$%"].map((rule) => (
          <span
            key={rule}
            className="flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[8px]"
            style={{ borderColor: soft(45), color: A, background: soft(8) }}
          >
            <span className="size-1.5 rounded-full" style={{ background: A }} />
            {rule}
          </span>
        ))}
        <span className="text-muted-foreground ml-auto font-mono text-[8px]">
          length 16
        </span>
      </div>
    </Fill>
  ),

  hash: () => (
    // Text in, a fingerprint out, with the algorithm picked in between.
    <Fill className="flex flex-col justify-center gap-2 px-[8%]">
      <div className="bg-card border-border rounded-lg border px-3 py-1.5 font-mono text-[9.5px]">
        hello world
      </div>
      <div className="flex gap-1">
        {["MD5", "SHA-1", "SHA-256", "SHA-512"].map((name) => (
          <span
            key={name}
            className="rounded-md px-2 py-0.5 font-mono text-[8px] font-semibold"
            style={
              name === "SHA-256"
                ? { background: A, color: "white" }
                : { background: soft(10), color: soft(80, "#888") }
            }
          >
            {name}
          </span>
        ))}
      </div>
      <div
        className="relative rounded-lg px-3 py-1.5 font-mono text-[8.5px] leading-relaxed break-all"
        style={{ background: soft(12), color: A }}
      >
        b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
        <span className="bg-card border-border text-foreground absolute -top-2 right-2 rounded-full border px-1.5 py-0.5 text-[7px] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          ✓ Copied
        </span>
      </div>
    </Fill>
  ),

  jsoncsv: () => (
    <Center className="gap-2.5 px-[6%]">
      <pre className="bg-card border-border rounded-xl border p-2.5 font-mono text-[8.5px] leading-snug text-muted-foreground">
        {"[{\n  "}
        <span style={{ color: A }}>&quot;name&quot;</span>
        {': "Ana",\n  '}
        <span style={{ color: A }}>&quot;city&quot;</span>
        {': "Porto"\n}]'}
      </pre>
      <span
        className={`${move} group-hover:translate-x-1`}
        style={{ color: A }}
      >
        →
      </span>
      <div className="border-border grid grid-cols-2 overflow-hidden rounded-lg border text-[8.5px]">
        {["name", "city", "Ana", "Porto", "Rui", "Lisbon"].map(
          (cell, index) => (
            <span
              key={cell}
              className="border-border border-b px-2 py-1"
              style={
                index < 2
                  ? { background: soft(18), color: A, fontWeight: 600 }
                  : undefined
              }
            >
              {cell}
            </span>
          ),
        )}
      </div>
    </Center>
  ),

  invoice: () => (
    <Center>
      <div
        className={`aspect-[3/4] h-[86%] space-y-2 rounded-md bg-white p-3 text-neutral-900 shadow-xl ${move} group-hover:-rotate-2`}
      >
        <div className="flex items-center justify-between">
          <span className="size-3.5 rounded" style={{ background: A }} />
          <span className="text-[7px] font-bold tracking-wide">
            INVOICE #042
          </span>
        </div>
        {[
          ["Design", "€800"],
          ["Build", "€360"],
          ["Hosting", "€80"],
        ].map(([item, price]) => (
          <div key={item} className="flex justify-between text-[6.5px]">
            <span>{item}</span>
            <span className="text-neutral-500">{price}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-neutral-200 pt-1.5 text-[8px] font-bold">
          <span>Total</span>
          <span style={{ color: A }}>€1,240</span>
        </div>
        <span
          className="block rounded-sm py-0.5 text-center text-[6px] font-bold text-white opacity-0 transition-opacity delay-200 duration-500 group-hover:opacity-100"
          style={{ background: A }}
        >
          PAID
        </span>
      </div>
    </Center>
  ),

  launchready: () => (
    // Scan a live page, get a score and the fixes that matter.
    <Fill className="flex flex-col justify-center gap-2 px-[7%]">
      <div className="bg-card border-border relative flex items-center gap-2 overflow-hidden rounded-full border py-1 pr-1 pl-3">
        <span className="font-mono text-[9px]">yoursite.com</span>
        <span
          className="ml-auto rounded-full px-2.5 py-1 text-[8px] font-semibold text-white"
          style={{ background: A }}
        >
          Scan
        </span>
        <span
          className="absolute bottom-0 left-0 h-[2px] w-0 transition-[width] duration-[1200ms] ease-out group-hover:w-full"
          style={{ background: A }}
        />
      </div>
      <div className="flex items-center gap-3">
        <div className="relative size-16 shrink-0">
          <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>
            <circle
              cx="40"
              cy="40"
              r="32"
              fill="none"
              className="stroke-foreground"
              opacity="0.12"
              strokeWidth="7"
            />
            <circle
              cx="40"
              cy="40"
              r="32"
              fill="none"
              stroke={A}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray="201"
              className="transition-[stroke-dashoffset] duration-1000 ease-out [stroke-dashoffset:60] group-hover:[stroke-dashoffset:16]"
            />
          </svg>
          <span className="font-heading absolute inset-0 grid place-items-center text-base font-bold">
            92
          </span>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-x-2 gap-y-1">
          {[
            ["Search", true],
            ["Accessibility", true],
            ["Security", false],
            ["Speed", true],
          ].map(([label, ok]) => (
            <span
              key={label as string}
              className="flex items-center gap-1 text-[8.5px]"
            >
              <span
                className={`grid size-3 shrink-0 place-items-center rounded-full text-[7px] font-bold text-white ${ok ? "" : "bg-amber-500"}`}
                style={ok ? { background: A } : undefined}
              >
                {ok ? "✓" : "!"}
              </span>
              {label}
            </span>
          ))}
          <span className="col-span-2 mt-0.5 truncate rounded-md bg-neutral-950 px-1.5 py-0.5 font-mono text-[7.5px] text-white/80">
            <span className="text-amber-400">fix</span> add
            Content-Security-Policy
          </span>
        </div>
      </div>
    </Fill>
  ),

  /* ======================================================== playground */

  editor: () => (
    <Fill className="flex items-stretch gap-2 p-[6%]">
      <div className="flex-1 space-y-1 rounded-xl bg-neutral-950 p-2.5 font-mono text-[8.5px] leading-snug">
        <p>
          <span className="text-fuchsia-400">&lt;button</span>
          <span className="text-sky-300"> class</span>
          <span className="text-white/50">=</span>
          <span className="text-amber-300">&quot;go&quot;</span>
          <span className="text-fuchsia-400">&gt;</span>
        </p>
        <p className="pl-3 text-white/70">Launch</p>
        <p className="text-fuchsia-400">&lt;/button&gt;</p>
        <p className="text-white/30">{"/* live */"}</p>
        <span className="inline-block h-2.5 w-[2px] animate-pulse bg-white/70" />
      </div>
      <Win className="flex-1">
        <div className="grid h-full place-items-center pb-4">
          <span
            className="rounded-full px-3 py-1.5 text-[10px] font-semibold text-white transition-transform duration-500 group-hover:scale-110"
            style={{ background: A }}
          >
            Launch
          </span>
        </div>
      </Win>
    </Fill>
  ),

  cyberlab: () => (
    <Center className="gap-4">
      <svg viewBox="0 0 100 110" className="h-[64%]" aria-hidden>
        <path
          d="M50 4l40 14v32c0 26-17 44-40 54C27 94 10 76 10 50V18Z"
          fill={soft(18)}
          stroke={A}
          strokeWidth="2.5"
        />
        <rect x="36" y="52" width="28" height="22" rx="5" fill={A} />
        <path
          d="M41 52v-6a9 9 0 0 1 18 0v6"
          fill="none"
          stroke={A}
          strokeWidth="4"
          className={`${move} group-hover:-translate-y-1.5`}
        />
      </svg>
      <div className="rounded-lg bg-neutral-950 p-2 font-mono text-[8px] leading-relaxed">
        <p className="text-white/50">$ inject &apos;--</p>
        <p className="text-red-400">✕ blocked</p>
        <p style={{ color: A }}>✓ input sanitised</p>
      </div>
    </Center>
  ),

  steganography: () => (
    <Center>
      <div className="relative aspect-[4/3] h-[74%] overflow-hidden rounded-xl">
        <Photo className="absolute inset-0" />
        <div className="absolute inset-0 grid place-items-center bg-black/0 transition-colors duration-500 group-hover:bg-black/45">
          <span className="rounded-lg bg-white/90 px-2.5 py-1 font-mono text-[10px] text-neutral-900 opacity-0 transition-opacity delay-200 duration-500 group-hover:opacity-100">
            🔒 meet at noon
          </span>
        </div>
      </div>
    </Center>
  ),

  /* ======================================================= experiments */

  // Two offset dot fields: the trick a magic-eye image plays on your eyes.
  stereogram: () => (
    <Fill className="bg-[length:10px_10px] transition-[background-position] duration-1000 group-hover:[background-position:5px_0,0_5px]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(${soft(70)} 1.4px, transparent 1.6px)`,
          backgroundSize: "10px 10px",
        }}
      />
      <div
        className="absolute inset-0 transition-transform duration-1000 group-hover:translate-x-[3px]"
        style={{
          backgroundImage: `radial-gradient(${soft(35)} 1.4px, transparent 1.6px)`,
          backgroundSize: "10px 10px",
          backgroundPosition: "5px 5px",
        }}
      />
      <span
        className="absolute top-1/2 left-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 blur-[2px] transition-opacity duration-700 group-hover:opacity-60"
        style={{ background: A }}
      />
    </Fill>
  ),

  spectro: () => (
    <Fill className="flex items-center justify-center gap-[3px] px-[8%]">
      {Array.from({ length: 34 }, (_, index) => {
        const height =
          18 + Math.abs(Math.sin(index * 0.55) * 52) + ((index * 13) % 15);
        return (
          <span
            key={index}
            className="w-[5px] rounded-full transition-transform duration-500 group-hover:scale-y-125"
            style={{
              height: `${height}%`,
              background: `linear-gradient(180deg, ${A}, ${soft(25)})`,
              ...delay(index * 15),
            }}
          />
        );
      })}
    </Fill>
  ),

  sorting: () => (
    <Fill className="flex items-end justify-center gap-1.5 px-[10%] pb-[10%]">
      {[40, 70, 25, 90, 55, 15, 80, 35, 65, 50].map((height, index) => {
        const sorted = [15, 25, 35, 40, 50, 55, 65, 70, 80, 90][index];
        return (
          <span
            key={index}
            className="flex-1 rounded-t-md transition-[height] duration-700 ease-out [height:var(--from)] group-hover:[height:var(--to)]"
            style={
              {
                "--from": `${height}%`,
                "--to": `${sorted}%`,
                background: soft(30 + sorted * 0.65),
                ...delay(index * 40),
              } as CSSProperties
            }
          />
        );
      })}
    </Fill>
  ),

  pathfinding: () => (
    <Fill>
      <svg
        viewBox="0 0 320 200"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        {Array.from({ length: 9 * 6 }, (_, index) => {
          const x = 52 + (index % 9) * 24;
          const y = 28 + Math.floor(index / 9) * 24;
          const wall = [11, 20, 29, 13, 22, 31, 40, 6, 15].includes(index);
          return (
            <rect
              key={index}
              x={x}
              y={y}
              width="22"
              height="22"
              rx="4"
              className="fill-foreground"
              opacity={wall ? 0.45 : 0.06}
            />
          );
        })}
        <path
          d="M63 39V87H111V159H183V63H255V159"
          fill="none"
          stroke={A}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="520"
          className="transition-[stroke-dashoffset] duration-[1200ms] ease-in-out [stroke-dashoffset:380] group-hover:[stroke-dashoffset:0]"
        />
        <circle cx="63" cy="39" r="7" fill={A} />
        <circle cx="255" cy="159" r="7" className="fill-foreground" />
      </svg>
    </Fill>
  ),
};
