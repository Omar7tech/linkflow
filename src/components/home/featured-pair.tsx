import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { TOOL_BY_ID } from "@/constants/tools";
import type { ToolId } from "@/constants/tools";
import { ChatVisual, CutoutVisual } from "./featured-visuals";
import { MockupVisual, QrVisual } from "./featured-visuals-more";

type Spotlight = {
  id: ToolId;
  title: string;
  description: string;
  Visual: () => React.ReactNode;
};

const SPOTLIGHTS: readonly Spotlight[] = [
  {
    id: "qr",
    title: "A QR code you'd print",
    description: "Add your logo, pick the colours and download it in seconds.",
    Visual: QrVisual,
  },
  {
    id: "mockup",
    title: "Your app on a real device",
    description: "Drop in a screenshot, turn the 3D phone, export the shot.",
    Visual: MockupVisual,
  },
  {
    id: "bgremover",
    title: "Erase any background",
    description: "Drop in a photo or a logo and get a crisp transparent PNG.",
    Visual: CutoutVisual,
  },
  {
    id: "whatsapp",
    title: "Links that open a chat",
    description: "A wa.me link with your message typed, ready for a bio or menu.",
    Visual: ChatVisual,
  },
];

export function FeaturedPair() {
  return (
    <section aria-labelledby="featured-heading" className="border-border/70 border-t">
      <div className="mx-auto w-full max-w-7xl px-6 py-16 sm:py-20">
        <div className="mb-8 flex items-end justify-between gap-6">
          <h2
            id="featured-heading"
            className="font-heading text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Most used<span className="text-primary">.</span>
          </h2>
          <Link
            href="/tools"
            className="group/all text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            All tools
            <ArrowRightIcon
              className="size-3.5 transition-transform group-hover/all:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                className="group border-border/60 bg-card/60 hover:border-primary/40 relative flex flex-col overflow-hidden rounded-[1.5rem] border transition-colors duration-300"
              >
                {/* Above the card's link overlay so the pointer can play with it; still a way in. */}
                <Link
                  href={tool.slug}
                  tabIndex={-1}
                  aria-hidden
                  className="relative z-10 m-1.5 block aspect-[5/4] overflow-hidden rounded-[1.15rem] sm:aspect-square"
                >
                  <Visual />
                </Link>

                <div className="flex flex-1 flex-col px-4 pt-3 pb-4">
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Icon className="text-primary size-3.5 shrink-0" aria-hidden />
                    {tool.shortName}
                  </p>
                  <h3
                    id={headingId}
                    className="font-heading mt-1.5 text-lg leading-snug font-semibold tracking-[-0.02em]"
                  >
                    <Link href={tool.slug} className="after:absolute after:inset-0">
                      {title}
                    </Link>
                    <span className="text-primary">.</span>
                  </h3>
                  <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
                    {description}
                  </p>
                  <span className="text-foreground group-hover:text-primary mt-auto flex items-center gap-1.5 pt-4 text-[13px] font-medium transition-colors">
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
