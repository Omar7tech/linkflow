import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { TOOL_BY_ID } from "@/constants/tools";
import type { ToolId } from "@/constants/tools";
import { ChatVisual, CutoutVisual } from "./featured-visuals";

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
                {/* Above the card's link overlay so the pointer can play with it; still a way in. */}
                <Link
                  href={tool.slug}
                  tabIndex={-1}
                  aria-hidden
                  className="relative z-10 m-2 block aspect-[16/10] overflow-hidden rounded-[1.35rem] lg:aspect-[2/1]"
                >
                  <Visual />
                </Link>

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
