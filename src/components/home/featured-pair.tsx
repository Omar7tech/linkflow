import Link from "next/link";
import Image from "next/image";
import { ArrowRightIcon } from "lucide-react";
import { TOOL_BY_ID } from "@/constants/tools";
import type { ToolId } from "@/constants/tools";

type Spotlight = {
  id: ToolId;
  eyebrow: string;
  title: string;
  description: string;
  capabilities: readonly string[];
  image: string;
};

const SPOTLIGHTS: readonly Spotlight[] = [
  {
    id: "bgremover",
    eyebrow: "Background Remover",
    title: "Erase any background, keep clean edges",
    description:
      "AI segmentation for photos, instant color matching for flat graphics. Drop in an image, get a crisp transparent PNG.",
    capabilities: ["AI segmentation", "Feathered edges", "Auto-trim", "Transparent PNG"],
    image: "/tools/background-remover.webp",
  },
  {
    id: "whatsapp",
    eyebrow: "WhatsApp Link Generator",
    title: "Click-to-chat links that open a conversation",
    description:
      "wa.me links with a prefilled message, formatted group invites, and bulk generation from a CSV of numbers.",
    capabilities: ["Prefilled message", "Group invites", "Bulk from CSV", "QR code"],
    image: "/tools/whatsapp.webp",
  },
];

export function FeaturedPair() {
  return (
    <section aria-label="Featured tools" className="border-border/70 border-t">
      <div className="mx-auto w-full max-w-7xl px-6 py-14 sm:py-20">
        <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
          {SPOTLIGHTS.map((s) => {
            const tool = TOOL_BY_ID[s.id];
            const Icon = tool.icon;
            const headingId = `spotlight-${s.id}-heading`;
            return (
              /* The whole card is the target — one tap area instead of a small
                 button inside something that already looks tappable. */
              <article
                key={s.id}
                aria-labelledby={headingId}
                className="group border-border/60 bg-card hover:border-primary/40 relative flex flex-col overflow-hidden rounded-2xl border transition-colors duration-200 hover:shadow-lg hover:shadow-emerald-500/5"
              >
                <div className="border-border/60 relative aspect-[16/10] w-full overflow-hidden border-b lg:aspect-[2/1]">
                  <Image
                    src={s.image}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                </div>

                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <p className="text-muted-foreground flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase">
                    <Icon className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    {s.eyebrow}
                  </p>

                  <h2
                    id={headingId}
                    className="font-heading mt-2.5 text-xl font-bold tracking-tight text-balance sm:text-2xl"
                  >
                    <Link href={tool.slug} className="after:absolute after:inset-0">
                      {s.title}
                    </Link>
                    <span className="text-primary">.</span>
                  </h2>

                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {s.description}
                  </p>

                  {/* Spec line rather than a chip grid — same information, one row. */}
                  <p className="text-muted-foreground/70 mt-4 font-mono text-[10px] leading-relaxed tracking-[0.14em] uppercase sm:text-[11px]">
                    {s.capabilities.join(" · ")}
                  </p>

                  <span className="text-foreground group-hover:text-primary mt-auto flex items-center gap-1.5 pt-5 text-sm font-medium transition-colors">
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
