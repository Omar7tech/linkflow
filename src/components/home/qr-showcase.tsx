import { QrCodeIcon } from "lucide-react";

/** Small deterministic PRNG so the decorative matrix is identical on server + client. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIZE = 25;
const CENTER = (SIZE - 1) / 2; // 12
const LOGO_HALF = 3; // clears a 7×7 hole for the centre chip

const FINDERS = [
  [0, 0],
  [SIZE - 7, 0],
  [0, SIZE - 7],
] as const;

function inFinder(x: number, y: number) {
  // 7×7 finder plus a 1-module separator around it
  return FINDERS.some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7);
}

function inLogo(x: number, y: number) {
  return Math.abs(x - CENTER) <= LOGO_HALF && Math.abs(y - CENTER) <= LOGO_HALF;
}

/** Decorative (non-scannable) data modules. */
const MODULES: { x: number; y: number }[] = (() => {
  const rng = mulberry32(20260727);
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (inFinder(x, y) || inLogo(x, y)) continue;
      if (rng() > 0.52) out.push({ x, y });
    }
  }
  return out;
})();

function Finder({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x + 0.15} y={y + 0.15} width={6.7} height={6.7} rx={2} fill="url(#qr-grad)" />
      <rect x={x + 1.15} y={y + 1.15} width={4.7} height={4.7} rx={1.4} fill="var(--background)" />
      <rect x={x + 2.15} y={y + 2.15} width={2.7} height={2.7} rx={0.9} fill="url(#qr-grad)" />
    </g>
  );
}

/**
 * Flagship QR visual: a frameless SVG QR that floats and tilts in 3D, with an
 * animated emerald scan line. No card, no borders. Reduced-motion safe.
 */
export function QrShowcase() {
  return (
    <div className="group [perspective:1400px] motion-safe:animate-[qr-float_7s_ease-in-out_infinite]">
      <div className="relative mx-auto aspect-square w-full max-w-[20rem] transform-gpu transition-transform duration-700 ease-out [transform-style:preserve-3d] [transform:rotateX(12deg)_rotateY(-15deg)] group-hover:[transform:rotateX(3deg)_rotateY(-4deg)]">
        {/* QR matrix */}
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="relative size-full drop-shadow-[0_24px_34px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_24px_40px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <defs>
            <linearGradient id="qr-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="55%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#0d9488" />
            </linearGradient>
          </defs>
          {FINDERS.map(([fx, fy]) => (
            <Finder key={`${fx}-${fy}`} x={fx} y={fy} />
          ))}
          {MODULES.map(({ x, y }) => (
            <rect
              key={`${x}-${y}`}
              x={x + 0.16}
              y={y + 0.16}
              width={0.68}
              height={0.68}
              rx={0.24}
              fill="url(#qr-grad)"
            />
          ))}
        </svg>

        {/* Centre logo chip */}
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg ring-4 ring-[var(--background)]">
            <QrCodeIcon className="size-8" aria-hidden />
          </div>
        </div>

        {/* Scan line */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[18%] motion-safe:animate-[qr-scan_2.8s_ease-in-out_infinite]">
            <div className="size-full bg-gradient-to-b from-transparent via-emerald-400/25 to-transparent" />
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-emerald-400 shadow-[0_0_16px_2px] shadow-emerald-400/70" />
          </div>
        </div>
      </div>
    </div>
  );
}
