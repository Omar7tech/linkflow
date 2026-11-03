import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { TOOL_BY_ID } from "@/constants/tools";
import type { ToolId } from "@/constants/tools";
import { ChatVisual, CutoutVisual } from "./featured-visuals";
import { QrVisual } from "./featured-visuals-more";

type Spotlight = {
  id: ToolId;
  line: string;
  Visual: () => React.ReactNode;
};

const SPOTLIGHTS: readonly Spotlight[] = [
  { id: "qr", line: "With your logo and colours, ready to print.", Visual: QrVisual },
  { id: "bgremover", line: "A clean transparent PNG from any photo.", Visual: CutoutVisual },
  { id: "whatsapp", line: "A link that opens a chat with your message typed.", Visual: ChatVisual },
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
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            All tools
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {SPOTLIGHTS.map(({ id, line, Visual }) => {
            const tool = TOOL_BY_ID[id];
            return (
              <article
                key={id}
                className="group border-border/60 bg-card hover:border-foreground/15 relative flex flex-col overflow-hidden rounded-2xl border transition-colors duration-300"
              >
                {/* Above the card's link overlay so the pointer can play with it. */}
                <Link
                  href={tool.slug}
                  tabIndex={-1}
                  aria-hidden
                  className="border-border/60 relative z-10 block aspect-[4/3] overflow-hidden border-b"
                >
                  <Visual />
                </Link>

                <div className="flex items-end justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <h3 className="font-heading text-base font-semibold tracking-tight">
                      <Link href={tool.slug} className="after:absolute after:inset-0">
                        {tool.name}
                      </Link>
                    </h3>
                    <p className="text-muted-foreground mt-1 text-sm">{line}</p>
                  </div>
                  <span
                    aria-hidden
                    className="border-border text-muted-foreground group-hover:bg-foreground group-hover:text-background grid size-8 shrink-0 place-items-center rounded-full border transition-colors duration-300 group-hover:border-transparent"
                  >
                    <ArrowUpRightIcon className="size-4" />
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
