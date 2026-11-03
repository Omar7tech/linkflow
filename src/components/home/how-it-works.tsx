import { CheckIcon, CopyIcon, DownloadIcon, FileIcon, PaletteIcon, QrCodeIcon, SearchIcon, ShareIcon } from "lucide-react";
import { Reveal } from "@/components/home/reveal";

/*
 * Three steps, each shown as the moment it describes rather than explained in
 * a paragraph. Same rules as the featured cards above: one object on a quiet
 * studio stage, the site's own surfaces, emerald as the only accent, and
 * nothing moves until the card is hovered.
 */

const STAGE =
  "relative flex aspect-[4/3] items-center justify-center overflow-hidden border-b border-border/60 bg-[radial-gradient(ellipse_70%_80%_at_50%_0%,#ffffff,transparent),linear-gradient(#f4f4f5,#e9e9ec)] dark:bg-[radial-gradient(ellipse_70%_80%_at_50%_0%,#1f1f22,transparent),linear-gradient(#111113,#09090b)]";

const OBJECT =
  "border-border/70 bg-card relative rounded-2xl border shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)]";

/** 1. Find the tool: a search with the right one already on top. */
function FindVisual() {
  const results = [
    { icon: QrCodeIcon, label: "QR Code Generator", active: true },
    { icon: ShareIcon, label: "Share Links" },
    { icon: PaletteIcon, label: "Color Palette" },
  ];
  return (
    <div className={`${OBJECT} w-[78%] max-w-[17rem] overflow-hidden`}>
      <div className="border-border/70 flex items-center gap-2 border-b px-3.5 py-2.5 text-[12px]">
        <SearchIcon className="text-muted-foreground size-3.5" aria-hidden />
        <span>qr</span>
        <span className="bg-primary h-3.5 w-px" aria-hidden />
      </div>
      <div className="space-y-0.5 p-1.5">
        {results.map(({ icon: Icon, label, active }) => (
          <div
            key={label}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] ${
              active ? "bg-primary/10 font-medium" : "text-muted-foreground"
            }`}
          >
            <Icon className={`size-3.5 ${active ? "text-primary" : ""}`} aria-hidden />
            {label}
            {active && (
              <kbd className="border-border/70 text-muted-foreground ml-auto rounded border px-1.5 font-mono text-[9px] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                ↵
              </kbd>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const TINTS = ["#d1fae5", "#a7f3d0", "#6ee7b7", "#34d399", "#10b981", "#047857", "#064e3b"];

/** 2. Type: one value in, the result already there. */
function TypeVisual() {
  return (
    <div className={`${OBJECT} w-[78%] max-w-[17rem] p-4`}>
      <p className="text-muted-foreground text-[10px]">Brand colour</p>
      <div className="border-border/70 bg-background mt-1.5 flex items-center gap-2 rounded-lg border px-2.5 py-2 font-mono text-[12px]">
        <span className="size-3.5 rounded" style={{ background: "#10b981" }} />
        #10b981
        <span className="bg-primary h-3.5 w-px" aria-hidden />
      </div>
      <p className="text-muted-foreground mt-3.5 text-[10px]">Palette</p>
      <div className="mt-1.5 flex gap-1">
        {TINTS.map((tint, index) => (
          <span
            key={tint}
            className="h-8 flex-1 rounded-md transition-transform duration-300 ease-out group-hover:-translate-y-1"
            style={{ background: tint, transitionDelay: `${index * 35}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/** 3. Keep it: the file, ready, with the download confirmed on hover. */
function KeepVisual() {
  return (
    <div className="relative w-[78%] max-w-[17rem]">
      <span className="bg-foreground text-background absolute -top-9 left-1/2 flex -translate-x-1/2 translate-y-1 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium whitespace-nowrap opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <CheckIcon className="size-3" aria-hidden /> Saved to Downloads
      </span>
      <div className={`${OBJECT} p-3.5`}>
        <div className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary grid size-9 place-items-center rounded-lg">
            <FileIcon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-medium">palette.svg</span>
            <span className="text-muted-foreground block text-[10px]">2 KB · no watermark</span>
          </span>
        </div>
        <div className="mt-3 flex gap-1.5">
          <span className="border-border/70 text-muted-foreground flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-[11px] font-medium">
            <CopyIcon className="size-3" aria-hidden /> Copy
          </span>
          <span className="bg-primary text-primary-foreground flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-medium">
            <DownloadIcon className="size-3" aria-hidden /> Download
          </span>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    title: "Open a tool",
    text: "Search or browse. Nothing to install, no account, no setup.",
    Visual: FindVisual,
  },
  {
    title: "Type your input",
    text: "The result updates as you type. No button to press, nothing to wait for.",
    Visual: TypeVisual,
  },
  {
    title: "Take it with you",
    text: "Copy it or download it. No watermark, no expiry, no email asked for.",
    Visual: KeepVisual,
  },
];

export function HowItWorks() {
  return (
    <section className="border-border/70 border-t" aria-labelledby="how-heading">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
        <Reveal className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="text-muted-foreground/70 text-xs font-medium tracking-wide">How it works</p>
            <h2 id="how-heading" className="font-heading mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
              It takes about ten seconds<span className="text-primary">.</span>
            </h2>
          </div>
          <p className="text-muted-foreground max-w-md leading-relaxed lg:col-span-5">
            Every tool works the same way, so once you have used one you know them all.
          </p>
        </Reveal>

        <Reveal className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ title, text, Visual }, index) => (
            <article
              key={title}
              className="group border-border/60 bg-card hover:border-foreground/15 overflow-hidden rounded-2xl border transition-colors duration-300"
            >
              <div className={STAGE} aria-hidden>
                <Visual />
              </div>
              <div className="p-5">
                <p className="text-muted-foreground/70 font-mono text-[11px] tabular-nums">
                  0{index + 1}
                </p>
                <h3 className="font-heading mt-1.5 text-base font-semibold tracking-tight">{title}</h3>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{text}</p>
              </div>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
