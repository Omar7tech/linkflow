import QRCode from "qrcode";
import styles from "./featured-pair.module.css";

/* ----------------------------------------------------------------------- qr */

/* A real code for the menu link. The middle is cleared for the logo, which
   high error correction can afford. */
const QR = (() => {
  const { modules } = QRCode.create("https://casaverde.pt/menu", {
    errorCorrectionLevel: "H",
  });
  const n = modules.size;
  const finder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const mid = (n - 1) / 2;
  const logo = (r: number, c: number) =>
    Math.abs(r - mid) <= 3.5 && Math.abs(c - mid) <= 3.5;
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

const INKS = ["#111111", "#047857", "#1e3a8a", "#c2410c"];

const CORNERS = [
  "top-0 left-0 border-t-2 border-l-2 rounded-tl-md",
  "top-0 right-0 border-t-2 border-r-2 rounded-tr-md",
  "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-md",
  "right-0 bottom-0 border-r-2 border-b-2 rounded-br-md",
];

/**
 * A printed table card with the menu's QR code. The ink cycles through the
 * swatches below it, and a phone camera frames and reads the code.
 */
export function QrVisual() {
  return (
    <div
      aria-hidden
      className="bg-muted/40 absolute inset-0 grid place-items-center"
    >
      <div className="flex flex-col items-center gap-4">
        {/* The printed card. */}
        <div className="relative flex w-[9.5rem] -rotate-3 flex-col items-center gap-2 rounded-xl bg-[#fbfaf7] px-3.5 pt-3 pb-2.5 text-neutral-900 shadow-[0_1px_0_rgb(0_0_0/0.04),0_18px_40px_-14px_rgb(0_0_0/0.45)] transition-transform duration-500 group-hover:rotate-0">
          <span className="text-[8px] font-semibold tracking-[0.22em] uppercase">
            Scan the menu
          </span>

          <div className={`${styles.ink} relative w-full`}>
            <svg viewBox={`-1 -1 ${QR.n + 2} ${QR.n + 2}`} className="block w-full">
              <g fill="currentColor">
                {QR.cells.map(([r, c]) => (
                  <rect
                    key={`${r}-${c}`}
                    x={c + 0.06}
                    y={r + 0.06}
                    width={0.88}
                    height={0.88}
                    rx={0.3}
                  />
                ))}
              </g>
              {QR.corners.map(([r, c]) => (
                <g key={`${r}-${c}`}>
                  <rect
                    x={c + 0.5}
                    y={r + 0.5}
                    width={6}
                    height={6}
                    rx={2}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1}
                  />
                  <rect x={c + 2} y={r + 2} width={3} height={3} rx={0.9} fill="currentColor" />
                </g>
              ))}
            </svg>

            {/* The logo in the middle. */}
            <span className="absolute top-1/2 left-1/2 grid size-[21%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[24%] bg-current shadow-[0_0_0_3px_#fbfaf7]">
              <span className="text-[8px] font-bold text-white">CV</span>
            </span>

            {/* The phone camera framing it, and reading it. */}
            <span className={`${styles.scanFrame} pointer-events-none absolute -inset-2`}>
              {CORNERS.map((corner) => (
                <span key={corner} className={`border-primary absolute size-4 ${corner}`} />
              ))}
              <span
                className={`${styles.scanLine} bg-primary absolute inset-x-1 h-px shadow-[0_0_10px_2px_var(--primary)]`}
              />
            </span>
          </div>

          <span className="font-mono text-[8px] text-neutral-500">casaverde.pt</span>
        </div>

        {/* The colour picker. */}
        <div className="bg-background/90 border-border flex items-center gap-2.5 rounded-full border py-1.5 pr-2.5 pl-3 shadow-sm backdrop-blur">
          <span className="text-muted-foreground text-[10px]">Colour</span>
          <span className="relative flex gap-1.5">
            {INKS.map((ink) => (
              <span key={ink} className="ring-foreground/20 size-3.5 rounded-full ring-1 ring-inset" style={{ background: ink }} />
            ))}
            <span
              className={`${styles.swatch} ring-foreground/70 absolute size-5 rounded-full ring-[1.5px]`}
            />
          </span>
        </div>
      </div>
    </div>
  );
}
