import Link from "next/link";
import { ArrowRightIcon, CheckCheckIcon, LinkIcon } from "lucide-react";
import { TOOL_BY_ID } from "@/constants/tools";
import type { ToolId } from "@/constants/tools";
import styles from "./featured-pair.module.css";

type Spotlight = {
  id: ToolId;
  title: string;
  description: string;
  Visual: () => React.ReactNode;
};

const SPOTLIGHTS: readonly Spotlight[] = [
  {
    id: "bgremover",
    title: "Erase any background, keep clean edges",
    description:
      "Drop in a photo or a logo and get a crisp transparent PNG back.",
    Visual: CutoutVisual,
  },
  {
    id: "whatsapp",
    title: "Links that open a WhatsApp chat",
    description:
      "A wa.me link with your message already typed, ready for your bio, menu or QR code.",
    Visual: ChatVisual,
  },
];

export function FeaturedPair() {
  return (
    <section aria-label="Featured tools" className="border-border/70 border-t">
      <div className="mx-auto w-full max-w-7xl px-6 py-16 sm:py-24">
        <div className="grid gap-5 md:grid-cols-2">
          {SPOTLIGHTS.map(({ id, title, description, Visual }) => {
            const tool = TOOL_BY_ID[id];
            const Icon = tool.icon;
            const headingId = `spotlight-${id}-heading`;
            return (
              /* The whole card is the target: one tap area instead of a small
                 button inside something that already looks tappable. */
              <article
                key={id}
                aria-labelledby={headingId}
                className="group border-border/60 bg-card/60 hover:border-primary/40 relative flex flex-col overflow-hidden rounded-[1.75rem] border transition-colors duration-300"
              >
                <div className="relative m-2 aspect-[16/10] overflow-hidden rounded-[1.35rem] lg:aspect-[2/1]">
                  <Visual />
                </div>

                <div className="flex flex-1 flex-col px-6 pt-4 pb-6 sm:px-7">
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Icon
                      className="text-primary size-4 shrink-0"
                      aria-hidden
                    />
                    {tool.name}
                  </p>
                  <h2
                    id={headingId}
                    className="font-heading mt-2 text-xl font-semibold tracking-[-0.02em] text-balance sm:text-2xl"
                  >
                    <Link
                      href={tool.slug}
                      className="after:absolute after:inset-0"
                    >
                      {title}
                    </Link>
                    <span className="text-primary">.</span>
                  </h2>
                  <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
                    {description}
                  </p>

                  <span className="text-foreground group-hover:text-primary mt-auto flex items-center gap-1.5 pt-6 text-sm font-medium transition-colors">
                    Open {tool.shortName}
                    <ArrowRightIcon
                      className="size-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- visuals */

/** A portrait, shown once as the photo and once as the cut-out, with a wipe moving between them. */
function CutoutVisual() {
  return (
    <div aria-hidden className="absolute inset-0">
      {/* The photo: a warm studio backdrop. */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,#fde68a,transparent_45%),radial-gradient(circle_at_80%_80%,#fb923c,transparent_50%),linear-gradient(135deg,#f59e0b,#ea580c)]">
        <Portrait />
      </div>
      {/* The cut-out: the same portrait on transparency. */}
      <div
        className={`${styles.cutout} absolute inset-0 bg-[#e9e9e9] bg-[length:20px_20px] [background-image:linear-gradient(45deg,#d4d4d4_25%,transparent_25%,transparent_75%,#d4d4d4_75%),linear-gradient(45deg,#d4d4d4_25%,transparent_25%,transparent_75%,#d4d4d4_75%)] [background-position:0_0,10px_10px] dark:bg-[#1c1c1c] dark:[background-image:linear-gradient(45deg,#262626_25%,transparent_25%,transparent_75%,#262626_75%),linear-gradient(45deg,#262626_25%,transparent_25%,transparent_75%,#262626_75%)]`}
      >
        <Portrait />
      </div>
      {/* The wipe's handle. */}
      <div
        className={`${styles.divider} absolute inset-y-0 w-px -translate-x-1/2 bg-white/90 shadow-[0_0_12px_rgb(0_0_0/0.35)]`}
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

/** A simple bust, in brand green with a soft light from above. */
function Portrait() {
  return (
    <svg
      viewBox="0 0 320 200"
      preserveAspectRatio="xMidYMax meet"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <linearGradient id="portrait-skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6ee7b7" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      <circle cx="160" cy="84" r="38" fill="url(#portrait-skin)" />
      <path
        d="M86 200c4-46 36-72 74-72s70 26 74 72Z"
        fill="url(#portrait-skin)"
      />
      <circle cx="148" cy="70" r="12" fill="#ffffff" opacity="0.22" />
    </svg>
  );
}

/** A tapped link opening a chat with the message already in it. */
function ChatVisual() {
  return (
    <div
      aria-hidden
      className="bg-muted/40 absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle,rgb(127_127_127/0.14)_1px,transparent_1px)] bg-[length:16px_16px] px-6"
    >
      <div
        className={`${styles.link} bg-background border-border flex max-w-full items-center gap-2 rounded-full border px-3.5 py-2 text-xs shadow-sm`}
      >
        <LinkIcon className="text-primary size-3.5 shrink-0" />
        <span className="truncate font-mono">
          wa.me/351912345678
          <span className="text-muted-foreground">
            ?text=Hi! I&apos;d like to book…
          </span>
        </span>
      </div>

      <div className="bg-background border-border w-full max-w-[19rem] overflow-hidden rounded-2xl border shadow-lg">
        <div className="border-border flex items-center gap-2.5 border-b px-3.5 py-2.5">
          <span className="bg-primary/15 text-primary grid size-7 place-items-center rounded-full text-[11px] font-semibold">
            CV
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-xs font-medium">Casa Verde</span>
            <span className="text-primary block text-[10px]">online</span>
          </span>
        </div>
        <div className="relative flex h-[5.5rem] items-end justify-end px-3.5 py-3">
          <span
            className={`${styles.typing} bg-muted absolute right-3.5 bottom-3 flex gap-1 rounded-2xl rounded-br-md px-3 py-2.5`}
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
            className={`${styles.message} bg-primary text-primary-foreground relative max-w-[85%] rounded-2xl rounded-br-md px-3 py-2 text-xs leading-snug shadow-sm`}
          >
            Hi! I&apos;d like to book a table for two on Friday.
            <span className="mt-0.5 flex items-center justify-end gap-1 text-[9px] opacity-80">
              19:42 <CheckCheckIcon className="size-3" />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
