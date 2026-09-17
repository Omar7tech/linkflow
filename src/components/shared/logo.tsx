import { cn } from "@/lib/utils";

/** TM TOOLS glyphs, from the 900×190 master logo file with TOOLS nudged 30 units right. */
const T = "0 48.15 44.73 48.15 44.73 163.62 63.31 163.62 63.31 48.15 107.68 48.15 107.68 31.57 0 31.57";

export const TM_GLYPHS = [
  // T
  <g key="t1" transform="translate(12 0)">
    <polygon points={T} />
  </g>,
  // M
  <g key="m" transform="translate(-295.96 0)">
    <polygon points="444.36 34.13 427.96 34.13 427.96 166.18 446.76 166.18 444.36 40.23 444.36 34.7 472.52 166.17 490.27 166.17 462.36 34.13" />
    <polygon points="518.56 34.13 492.12 159.32 490.65 166.17 508.4 166.17 536.68 34.13" />
    <polygon points="534.2 166.18 553 166.18 553 34.13 536.79 34.13" />
  </g>,
  // T
  <g key="t2" transform="translate(308 0)">
    <polygon points={T} />
  </g>,
  // Stretched O
  <path
    key="o"
    transform="translate(30 0)"
    fillRule="evenodd"
    d="M462.85 29.75H602.15A67.85 67.85 0 0 1 670 97.6A67.85 67.85 0 0 1 602.15 165.45H462.85A67.85 67.85 0 0 1 395 97.6A67.85 67.85 0 0 1 462.85 29.75ZM462.85 48.55A49.05 49.05 0 0 0 413.8 97.6A49.05 49.05 0 0 0 462.85 146.65H602.15A49.05 49.05 0 0 0 651.2 97.6A49.05 49.05 0 0 0 602.15 48.55Z"
  />,
  // L
  <path key="l" transform="translate(30 0)" d="M680 34.13H698.8V149.6H758V166.18H680Z" />,
  // S
  <g key="s" transform="translate(-126.29 0)">
    <path d="M985.12,90.2c-1.76-.54-3.51-1.07-5.24-1.61-21.87-6.79-31.01-11.49-31.01-23.07,0-7.14,2.97-16.62,28.62-16.62,21.22,0,33.9,10.97,33.9,29.35v1.93h18.76v-1.93c0-22.2-13.83-45.93-52.66-45.93s-47.39,18.25-47.39,33.57c0,23.69,18.66,31.16,45.03,39.12,2.19.65,4.4,1.27,6.61,1.89,17.96,5.04,34.92,9.81,34.92,25.72,0,13.18-9.7,18.8-32.44,18.8-25.42,0-41.17-5.88-41.17-35.17v-1.93h-18.76v1.93c0,35.31,19.04,51.75,59.93,51.75,33.98,0,51.21-12.15,51.21-36.11,0-26.31-26.72-34.48-50.3-41.69Z" />
  </g>,
];

/** Viewbox trimmed to the ink of the master logo. */
export const TM_VIEWBOX = "12 22 896 158";

/** Compact "TM" mark — the first two glyphs of the wordmark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="4 22 262 158" className={cn("h-6 w-auto fill-current", className)} aria-hidden>
      {TM_GLYPHS.slice(0, 2)}
    </svg>
  );
}

export function Logo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  if (!withWordmark) return <LogoMark className={className} />;
  return (
    <svg
      viewBox={TM_VIEWBOX}
      role="img"
      aria-label="TM TOOLS"
      className={cn("text-foreground h-5 w-auto fill-current", className)}
    >
      {TM_GLYPHS}
    </svg>
  );
}
