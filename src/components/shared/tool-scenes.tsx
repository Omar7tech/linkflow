/**
 * Tool cards: a small drawing of what each tool makes, in place of a picture.
 *
 * Each scene shows the tool's result, often as a before-and-after, in the
 * card's category colour (`--card-accent`) and the page's own neutrals, so the
 * grid reads as one set. Scenes hold still until their card is hovered and then
 * act out the job a little: dozens of cards on a page never animate at once.
 */
import type { CSSProperties, ReactNode } from "react";

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
function AppScreen({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className="flex h-full flex-col gap-[6%] p-[8%]"
      style={{
        background: `linear-gradient(170deg, ${soft(28, "#0b0b0b")}, #0b0b0b 70%)`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="h-[5px] w-[40%] rounded-full bg-white/70" />
        <span className="size-[8px] rounded-full" style={{ background: A }} />
      </div>
      <div
        className="aspect-[16/10] rounded-[6px]"
        style={{
          background: `linear-gradient(135deg, ${A}, ${soft(40, "#111")})`,
        }}
      />
      {!compact &&
        [70, 55, 62].map((width) => (
          <div key={width} className="flex items-center gap-[6%]">
            <span className="size-[10px] shrink-0 rounded-[3px] bg-white/15" />
            <span
              className="h-[4px] rounded-full bg-white/25"
              style={{ width: `${width}%` }}
            />
          </div>
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------ scenes */

export const SCENES: Record<string, () => ReactNode> = {
  /* ============================================================ studio */

  mockup: () => (
    <Fill className="[perspective:900px]">
      {/* Laptop */}
      <div className="absolute top-[14%] left-[24%] w-[58%] transition-transform duration-700 ease-out [transform:rotateY(-14deg)] group-hover:[transform:rotateY(-4deg)]">
        <div className="rounded-t-[10px] border-[3px] border-b-0 border-neutral-700 bg-neutral-900 p-[3px]">
          <div className="aspect-[16/10] overflow-hidden rounded-[5px]">
            <AppScreen compact />
          </div>
        </div>
        <div className="mx-[-7%] h-[7px] rounded-b-[6px] bg-gradient-to-b from-neutral-500 to-neutral-700" />
      </div>
      {/* Phone */}
      <div className="absolute top-[26%] left-[14%] w-[19%] transition-transform duration-700 ease-out [transform:rotateY(18deg)_rotateZ(-3deg)] group-hover:[transform:rotateY(4deg)_rotateZ(0deg)_translateY(-4px)]">
        <div className="relative aspect-[9/19] rounded-[14px] bg-gradient-to-br from-neutral-500 via-neutral-800 to-neutral-600 p-[2.5px] shadow-[0_20px_40px_-12px_rgb(0_0_0/0.7)]">
          <span className="absolute top-[22%] -right-[2px] h-[12%] w-[2px] rounded-full bg-neutral-500" />
          <div className="relative h-full overflow-hidden rounded-[12px] bg-black">
            <AppScreen />
            <span className="absolute top-[3%] left-1/2 h-[4%] w-[34%] -translate-x-1/2 rounded-full bg-black" />
            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgb(255_255_255/0.18),transparent_40%)]" />
          </div>
        </div>
      </div>
    </Fill>
  ),

  favicon: () => (
    <Fill className="flex flex-col justify-center gap-4 px-[8%]">
      <div className="bg-foreground/[0.06] flex items-end gap-1 rounded-t-xl px-2 pt-2">
        <div
          className={`bg-card border-border flex min-w-0 flex-1 items-center gap-2 rounded-t-lg border border-b-0 px-3 py-2 ${move} group-hover:-translate-y-0.5`}
        >
          <span
            className="grid size-4 shrink-0 place-items-center rounded-[5px] text-[9px] font-bold text-white"
            style={{ background: A }}
          >
            M
          </span>
          <span className="truncate text-[10px] font-medium">My App</span>
          <span className="text-muted-foreground ml-auto text-[10px]">×</span>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
          <span className="size-3.5 rounded-full bg-foreground/20" />
          <Bar w="50%" />
        </div>
      </div>
      <div className="flex items-end justify-center gap-3">
        {[16, 24, 36, 48].map((size, index) => (
          <div key={size} className="flex flex-col items-center gap-1">
            <span
              className={`grid place-items-center rounded-[28%] font-bold text-white ${move} group-hover:-translate-y-1`}
              style={{
                width: size,
                height: size,
                fontSize: size * 0.5,
                background: A,
                ...delay(index * 60),
              }}
            >
              M
            </span>
            <span className="text-muted-foreground font-mono text-[8px]">
              {[16, 32, 180, 512][index]}
            </span>
          </div>
        ))}
      </div>
    </Fill>
  ),

  logo: () => (
    <Fill className="grid grid-cols-4 gap-2 p-[7%]">
      {[
        { bg: "#ffffff", mark: A },
        { bg: "#0a0a0a", mark: "#ffffff" },
        { bg: soft(60), mark: "#ffffff" },
        { bg: "#a3a3a3", mark: "#0a0a0a" },
      ].map((tile, index) => (
        <div
          key={index}
          className={`border-border/60 flex flex-col items-center justify-center gap-1.5 rounded-xl border ${move} group-hover:-translate-y-1`}
          style={{ background: tile.bg, ...delay(index * 60) }}
        >
          <svg viewBox="0 0 24 24" className="size-[40%]" aria-hidden>
            <circle
              cx="9"
              cy="12"
              r="6"
              fill="none"
              stroke={tile.mark}
              strokeWidth="3"
            />
            <rect x="15" y="6" width="4" height="12" rx="2" fill={tile.mark} />
          </svg>
          <span
            className="h-[3px] w-[45%] rounded-full opacity-50"
            style={{ background: tile.mark }}
          />
        </div>
      ))}
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
    <Center className="[perspective:600px]">
      <div className="relative transition-transform duration-700 ease-out [transform:rotateY(-28deg)_rotateX(12deg)] [transform-style:preserve-3d] group-hover:[transform:rotateY(18deg)_rotateX(8deg)]">
        {Array.from({ length: 10 }, (_, index) => (
          <svg
            key={index}
            viewBox="0 0 100 100"
            className="absolute inset-0 size-28"
            style={{ transform: `translateZ(${-index * 2}px)` }}
            aria-hidden
          >
            <path
              d="M50 8 88 30v40L50 92 12 70V30Z"
              fill={
                index === 0 ? "url(#logo3d-face)" : soft(70 - index * 4, "#111")
              }
            />
          </svg>
        ))}
        <svg viewBox="0 0 100 100" className="relative size-28" aria-hidden>
          <defs>
            <linearGradient id="logo3d-face" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.45" stopColor={A} />
              <stop offset="1" stopColor="#111" />
            </linearGradient>
          </defs>
          <path d="M50 8 88 30v40L50 92 12 70V30Z" fill="url(#logo3d-face)" />
          <path
            d="M38 34h24M50 34v34"
            stroke="white"
            strokeWidth="7"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </Center>
  ),

  ogstudio: () => (
    <Center>
      <div
        className={`border-border bg-card w-[74%] rounded-2xl border p-3 shadow-lg ${move} group-hover:-translate-y-1`}
      >
        <div className="mb-2 flex items-center gap-2">
          <span
            className="size-5 rounded-full"
            style={{ background: soft(50) }}
          />
          <Bar w="28%" strong />
          <Bar w="16%" />
        </div>
        <div className="border-border overflow-hidden rounded-xl border">
          <div
            className="relative flex aspect-[1.91/1] flex-col justify-end gap-1 p-2.5"
            style={{
              background: `linear-gradient(135deg, ${soft(85, "#0b0b0b")}, #0b0b0b)`,
            }}
          >
            <span className="font-heading text-[11px] leading-tight font-bold text-white">
              Launch day is here
            </span>
            <span className="h-1 w-1/2 rounded-full bg-white/40" />
          </div>
          <div className="space-y-1 px-2.5 py-1.5">
            <span className="text-muted-foreground block font-mono text-[8px]">
              yoursite.com
            </span>
          </div>
        </div>
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
    <Center className="gap-3">
      {[
        {
          skin: "#f5d0a9",
          hair: "#3f2a1d",
          bg: soft(55),
          shape: "rounded-full",
        },
        { skin: "#c68b59", hair: "#111", bg: soft(85), shape: "rounded-[30%]" },
        {
          skin: "#ffe0bd",
          hair: "#d97706",
          bg: soft(35),
          shape: "rounded-full",
        },
      ].map((face, index) => (
        <svg
          key={index}
          viewBox="0 0 64 64"
          className={`${index === 1 ? "size-[30%] max-w-24" : "size-[22%] max-w-16"} ${face.shape} ${move} group-hover:-translate-y-1.5`}
          style={{ background: face.bg, ...delay(index * 70) }}
          aria-hidden
        >
          <path d="M14 64c2-14 9-20 18-20s16 6 18 20Z" fill={face.skin} />
          <circle cx="32" cy="30" r="13" fill={face.skin} />
          <path
            d="M19 28c0-10 6-15 13-15s13 5 13 15c-3-5-8-7-13-7s-10 2-13 7Z"
            fill={face.hair}
          />
          <circle cx="27" cy="31" r="1.6" fill="#1f1f1f" />
          <circle cx="37" cy="31" r="1.6" fill="#1f1f1f" />
          <path
            d="M28 37q4 3 8 0"
            stroke="#1f1f1f"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      ))}
    </Center>
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
    <Center className="gap-3">
      {["Plan your week", "Share with friends"].map((caption, index) => (
        <div
          key={caption}
          className={`flex aspect-[9/16] w-[26%] flex-col items-center gap-1.5 rounded-xl p-2 ${move} ${index ? "group-hover:translate-x-1.5" : "group-hover:-translate-x-1.5"}`}
          style={{ background: index ? soft(35) : soft(70) }}
        >
          <span className="font-heading text-center text-[9px] leading-tight font-bold text-white">
            {caption}
          </span>
          <div className="w-[82%] flex-1 overflow-hidden rounded-[8px] border-[2px] border-neutral-900 bg-black">
            <AppScreen />
          </div>
        </div>
      ))}
    </Center>
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
        <span style={{ color: A }}>↗</span>
        <span className="truncate">wa.me/351912…?text=Hi!</span>
      </span>
      <Win bar={false} className="w-full max-w-[15rem]">
        <div className="border-border/70 flex items-center gap-2 border-b px-2.5 py-1.5">
          <span
            className="size-4 rounded-full"
            style={{ background: soft(45) }}
          />
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
    <Center className="gap-3">
      <Win className="w-[44%]">
        <div className="space-y-1.5 p-2">
          <Bar w="50%" strong />
          <span
            className="block aspect-[16/7] rounded-md"
            style={{ background: soft(35) }}
          />
          <Bar w="80%" />
          <span
            className="block h-3 w-1/2 rounded-full"
            style={{ background: A }}
          />
        </div>
      </Win>
      <span
        className={`text-sm ${move} group-hover:translate-x-1`}
        style={{ color: A }}
      >
        →
      </span>
      <div className="space-y-1.5">
        <div className="flex gap-1">
          {[95, 60, 25].map((amount) => (
            <span
              key={amount}
              className="size-5 rounded-md"
              style={{ background: soft(amount, "#0b0b0b") }}
            />
          ))}
        </div>
        <p className="font-heading text-[11px] font-bold">Aa Inter</p>
        <p className="text-muted-foreground font-mono text-[8px]">
          radius 12 · 4/8 grid
        </p>
      </div>
    </Center>
  ),

  /* ========================================================= utilities */

  password: () => (
    <Fill className="flex flex-col justify-center gap-2.5 px-[12%]">
      <div className="bg-card border-border flex items-center justify-between rounded-xl border px-3 py-2.5 font-mono text-[12px] tracking-wider">
        <span>
          x7<span style={{ color: A }}>#</span>Qp
          <span style={{ color: A }}>!</span>m2Rw
          <span style={{ color: A }}>$</span>9
        </span>
        <span className="text-muted-foreground text-[9px]">copy</span>
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${index === 3 ? "bg-foreground/10 group-hover:bg-[var(--card-accent)]" : ""}`}
            style={index < 3 ? { background: A } : delay(200)}
          />
        ))}
        <span className="ml-1 text-[9px] font-semibold" style={{ color: A }}>
          Strong
        </span>
      </div>
    </Fill>
  ),

  hash: () => (
    <Fill className="flex flex-col items-center justify-center gap-2 px-[8%] font-mono text-[9px]">
      <span className="bg-card border-border rounded-lg border px-3 py-1.5">
        hello world
      </span>
      <span className="text-[8px] tracking-widest" style={{ color: A }}>
        ↓ SHA-256
      </span>
      <span
        className="w-full rounded-lg px-3 py-1.5 text-center leading-relaxed break-all"
        style={{ background: soft(12), color: A }}
      >
        b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
      </span>
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
    <Center className="gap-4">
      <div className="relative size-20">
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
            className="transition-[stroke-dashoffset] duration-1000 ease-out [stroke-dashoffset:80] group-hover:[stroke-dashoffset:16]"
          />
        </svg>
        <span className="font-heading absolute inset-0 grid place-items-center text-lg font-bold">
          92
        </span>
      </div>
      <div className="space-y-2">
        {["Search", "Speed", "Security"].map((label, index) => (
          <div
            key={label}
            className={`flex items-center gap-1.5 ${move} group-hover:translate-x-1`}
            style={delay(index * 70)}
          >
            <span
              className="grid size-3.5 place-items-center rounded-full text-[8px] text-white"
              style={{ background: A }}
            >
              ✓
            </span>
            <span className="text-[10px]">{label}</span>
          </div>
        ))}
      </div>
    </Center>
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
