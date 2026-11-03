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
      className="bg-muted/40 absolute inset-0 grid place-items-center bg-[radial-gradient(circle,rgb(127_127_127/0.14)_1px,transparent_1px)] bg-[length:16px_16px]"
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

/* ------------------------------------------------------------------- mockup */

/**
 * A phone on a slow turntable in a studio: titanium edges with real depth,
 * an illustrated lock screen, and a softbox sliding across the glass.
 */
export function MockupVisual() {
  return (
    <div aria-hidden className="bg-muted/40 absolute inset-0 overflow-hidden [perspective:900px]">
      {/* Studio light and the floor. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_40%,rgb(255_255_255/0.75),transparent_70%)] dark:bg-[radial-gradient(ellipse_50%_60%_at_50%_40%,rgb(255_255_255/0.07),transparent_70%)]" />
      <span
        className={`${styles.floor} absolute bottom-[8%] left-1/2 h-[5%] w-[34%] -translate-x-1/2 rounded-[50%] bg-black/40 blur-md`}
      />

      <div className={`${styles.turntable} absolute top-[9%] left-1/2 h-[76%] [transform-style:preserve-3d]`}>
        {/* The frame's thickness: stacked titanium edges behind the front. */}
        {Array.from({ length: 8 }, (_, index) => (
          <span
            key={index}
            className="absolute inset-0 rounded-[18px]"
            style={{
              transform: `translateZ(${-(index + 1)}px)`,
              background: `linear-gradient(90deg,#5d5d62,#cfcfd4 ${28 + index * 5}%,#6e6e73)`,
            }}
          />
        ))}

        <div className="relative aspect-[9/19.5] h-full rounded-[18px] bg-[linear-gradient(135deg,#ececef,#8c8c92_35%,#d8d8dc_60%,#77777d)] p-[3px] shadow-[0_30px_60px_-24px_rgb(0_0_0/0.7)]">
          <span className="absolute top-[18%] -left-[2px] h-[5%] w-[3px] rounded-l-full bg-[#9a9aa0]" />
          <span className="absolute top-[26%] -left-[2px] h-[9%] w-[3px] rounded-l-full bg-[#9a9aa0]" />
          <span className="absolute top-[37%] -left-[2px] h-[9%] w-[3px] rounded-l-full bg-[#9a9aa0]" />
          <span className="absolute top-[29%] -right-[2px] h-[13%] w-[3px] rounded-r-full bg-[#9a9aa0]" />

          <div className="h-full rounded-[15px] bg-black p-[3.5px]">
            <div className="relative h-full overflow-hidden rounded-[12px] bg-[radial-gradient(120%_70%_at_20%_8%,#34d39966,transparent_55%),radial-gradient(100%_70%_at_90%_100%,#0f766e80,transparent_60%),linear-gradient(170deg,#0b1f1a,#050807)]">
              <span className="absolute top-[2.5%] left-1/2 h-[4%] w-[30%] -translate-x-1/2 rounded-full bg-black" />
              <div className="flex items-center justify-between px-[12%] pt-[6.5%]">
                <span className="h-[4px] w-[16%] rounded-full bg-white/85" />
                <span className="flex gap-[2px]">
                  <span className="h-[4px] w-[7px] rounded-full bg-white/70" />
                  <span className="h-[4px] w-[9px] rounded-[1.5px] bg-white/85" />
                </span>
              </div>

              {/* The clock, drawn: a date line over two digit blocks. */}
              <div className="mt-[12%] flex flex-col items-center gap-[6px]">
                <span className="h-[3px] w-[32%] rounded-full bg-white/55" />
                <span className="flex items-center gap-[4px]">
                  <span className="h-[22px] w-[20px] rounded-[5px] bg-white/90" />
                  <span className="flex flex-col gap-[4px]">
                    <span className="size-[3px] rounded-full bg-white/90" />
                    <span className="size-[3px] rounded-full bg-white/90" />
                  </span>
                  <span className="h-[22px] w-[20px] rounded-[5px] bg-white/90" />
                </span>
              </div>

              {/* Notifications, drawn. */}
              <div className="absolute inset-x-[8%] bottom-[17%] space-y-[5px]">
                {[0, 1].map((index) => (
                  <div
                    key={index}
                    className="flex items-center gap-[6px] rounded-[8px] bg-white/15 px-[6px] py-[6px] ring-1 ring-white/10"
                  >
                    <span
                      className={`size-[12px] shrink-0 rounded-[3.5px] ${index ? "bg-white/85" : "bg-emerald-400"}`}
                    />
                    <span className="flex flex-1 flex-col gap-[3px]">
                      <span className="h-[3px] w-[55%] rounded-full bg-white/80" />
                      <span className="h-[3px] w-[80%] rounded-full bg-white/40" />
                    </span>
                  </div>
                ))}
              </div>

              <div className="absolute inset-x-[13%] bottom-[6%] flex justify-between">
                <span className="size-[15px] rounded-full bg-black/35 ring-1 ring-white/10" />
                <span className="size-[15px] rounded-full bg-black/35 ring-1 ring-white/10" />
              </div>
              <span className="absolute bottom-[2%] left-1/2 h-[2px] w-[34%] -translate-x-1/2 rounded-full bg-white/85" />

              {/* A softbox sliding across the glass as it turns. */}
              <span
                className={`${styles.glare} pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,rgb(255_255_255/0.26)_45%,rgb(255_255_255/0.05)_55%,transparent_62%)] [background-size:250%_100%]`}
              />
            </div>
          </div>
        </div>
      </div>

      <span className="bg-background/85 border-border absolute top-3 right-3 rounded-full border px-2.5 py-1 font-mono text-[10px] backdrop-blur">
        PNG · 4×
      </span>
    </div>
  );
}
