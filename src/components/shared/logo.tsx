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
  // OO: two meshing gears, their rims as thick as the letter strokes. Eight teeth each, so a turn of 45° in opposite
  // directions keeps them locked together (see .tm-gear in globals.css).
  <g key="oo" transform="translate(30 0)">
    <path data-gear="a" className="tm-gear" fillRule="evenodd" d="M523.04 85.23L538.96 89.08L538.96 106.12L523.04 109.97L516.69 125.29L525.23 139.28L513.18 151.33L499.19 142.79L483.87 149.14L480.02 165.06L462.98 165.06L459.13 149.14L443.81 142.79L429.82 151.33L417.77 139.28L426.31 125.29L419.96 109.97L404.04 106.12L404.04 89.08L419.96 85.23L426.31 69.91L417.77 55.92L429.82 43.87L443.81 52.41L459.13 46.06L462.98 30.14L480.02 30.14L483.87 46.06L499.19 52.41L513.18 43.87L525.23 55.92L516.69 69.91ZM437.5 97.6A34 34 0 1 0 505.5 97.6A34 34 0 1 0 437.5 97.6Z" />
    <path data-gear="b" className="tm-gear" fillRule="evenodd" d="M645.85 105.89L659.09 115.54L652.57 131.29L636.38 128.75L624.65 140.48L627.19 156.67L611.44 163.19L601.79 149.95L585.21 149.95L575.56 163.19L559.81 156.67L562.35 140.48L550.62 128.75L534.43 131.29L527.91 115.54L541.15 105.89L541.15 89.31L527.91 79.66L534.43 63.91L550.62 66.45L562.35 54.72L559.81 38.53L575.56 32.01L585.21 45.25L601.79 45.25L611.44 32.01L627.19 38.53L624.65 54.72L636.38 66.45L652.57 63.91L659.09 79.66L645.85 89.31ZM559.5 97.6A34 34 0 1 0 627.5 97.6A34 34 0 1 0 559.5 97.6Z" />
  </g>,
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
