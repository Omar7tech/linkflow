import Link from "next/link";
import Image from "next/image";
import {
  ArrowRightIcon,
  BinaryIcon,
  BoxSelectIcon,
  MessageSquareTextIcon,
  QrCodeIcon,
  ScissorsIcon,
  SparklesIcon,
  UsersIcon,
  UploadIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TOOL_BY_ID } from "@/constants/tools";
import type { ToolId } from "@/constants/tools";

type Spotlight = {
  id: ToolId;
  eyebrow: string;
  title: string;
  description: string;
  capabilities: readonly { icon: LucideIcon; label: string }[];
  cta: string;
  secondary: { href: string; label: string };
  image: string;
};

const SPOTLIGHTS: readonly Spotlight[] = [
  {
    id: "bgremover",
    eyebrow: "Background Remover",
    title: "Erase any background, keep clean edges",
    description:
      "AI segmentation for photos, instant color-matching for flat graphics — with feathered edges and auto-trim. Drop in an image and get a crisp transparent PNG.",
    capabilities: [
      { icon: SparklesIcon, label: "AI segmentation" },
      { icon: BoxSelectIcon, label: "Feathered edges" },
      { icon: ScissorsIcon, label: "Auto-trim" },
      { icon: BinaryIcon, label: "Transparent PNG" },
    ],
    cta: "Open the background remover",
    secondary: { href: "/tools#cat-image", label: "Browse image tools" },
    image: "/tools/bg-remover.webp",
  },
  {
    id: "whatsapp",
    eyebrow: "WhatsApp Link Generator",
    title: "Click-to-chat links that open a conversation",
    description:
      "Create wa.me links with a prefilled message, format group invites, and bulk-generate links from a CSV of numbers — ready to paste anywhere or share as a QR.",
    capabilities: [
      { icon: MessageSquareTextIcon, label: "Prefilled message" },
      { icon: UsersIcon, label: "Group invites" },
      { icon: UploadIcon, label: "Bulk from CSV" },
      { icon: QrCodeIcon, label: "QR code" },
    ],
    cta: "Open the WhatsApp generator",
    secondary: { href: "/tools#cat-links", label: "Browse link tools" },
    image: "/tools/whatsapp.webp",
  },
];

export function FeaturedPair() {
  return (
    <section aria-label="Featured tools" className="border-border/70 border-t">
      <div className="mx-auto w-full max-w-7xl px-6 py-16 sm:py-20">
        <div className="grid gap-6 md:grid-cols-2">
          {SPOTLIGHTS.map((s) => {
            const tool = TOOL_BY_ID[s.id];
            const Icon = tool.icon;
            const headingId = `spotlight-${s.id}-heading`;
            return (
              <article
                key={s.id}
                aria-labelledby={headingId}
                className="group border-border/60 bg-card flex flex-col overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/5"
              >
                {/* Banner image */}
                <div className="border-border/60 relative aspect-[16/9] w-full overflow-hidden border-b">
                  <Image
                    src={s.image}
                    alt={`${tool.name} illustration`}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                </div>

                <div className="flex flex-1 flex-col p-8">
                  <p className="flex items-center gap-2 font-mono text-xs font-medium tracking-[0.2em] text-emerald-700 uppercase dark:text-emerald-400">
                    <Icon className="size-3.5" aria-hidden />
                    {s.eyebrow}
                  </p>
                  <h2
                    id={headingId}
                    className="font-heading mt-3 text-2xl font-bold tracking-tight text-balance sm:text-3xl"
                  >
                    {s.title}
                    <span className="text-primary">.</span>
                  </h2>
                  <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                    {s.description}
                  </p>

                  <ul className="mt-6 flex flex-wrap gap-2">
                    {s.capabilities.map(({ icon: CapIcon, label }) => (
                      <li
                        key={label}
                        className="border-border/60 bg-card/50 flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium"
                      >
                        <CapIcon
                          className="size-3.5 text-emerald-600 dark:text-emerald-400"
                          aria-hidden
                          strokeWidth={1.75}
                        />
                        {label}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 flex flex-wrap items-center gap-5 pt-2">
                    <Button
                      asChild
                      size="lg"
                      className="group/btn h-11 rounded-full px-7 font-semibold"
                    >
                      <Link href={tool.slug}>
                        {s.cta}
                        <ArrowRightIcon
                          className="size-4 transition-transform group-hover/btn:translate-x-0.5"
                          aria-hidden
                        />
                      </Link>
                    </Button>
                    <Link
                      href={s.secondary.href}
                      className="text-foreground text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {s.secondary.label}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
