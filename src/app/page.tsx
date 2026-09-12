import { Fragment } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { FavoritesSection } from "@/components/home/favorites-section";
import { FeaturedPair } from "@/components/home/featured-pair";
import { FreeReceipt } from "@/components/home/free-receipt";
import { CategoryWheel } from "@/components/home/category-wheel";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { QrSpotlight } from "@/components/home/qr-spotlight";
import { Reveal } from "@/components/home/reveal";
import { JsonLd, faqJsonLd, webAppJsonLd } from "@/components/shared/json-ld";
import { FAQ_ITEMS } from "@/constants/faq";
import { SITE } from "@/constants/site";
import { TOOLS, TOOL_CATEGORIES } from "@/constants/tools";
import { accentFor } from "@/lib/tool-accent";

const HOME_FAQ = FAQ_ITEMS.slice(0, 5);

const PRINCIPLES = [
  {
    title: "Private by design",
    text: "Your input is used only to generate your output. No accounts, no ad pixels, no analytics watching what you type.",
  },
  {
    title: "Fast by architecture",
    text: "Every tool ships as its own tiny bundle and loads only when you open it, so pages stay light and first paint stays instant.",
  },
];

function SectionHeader({
  label,
  title,
  id,
  className,
}: {
  label: string;
  title: string;
  id?: string;
  className?: string;
}) {
  return (
    <Reveal className={className}>
      <p className="text-muted-foreground/70 text-xs font-medium tracking-wide">{label}</p>
      <h2
        id={id}
        className="font-heading mt-2 text-4xl font-bold tracking-tight sm:text-5xl"
      >
        {title}
        <span className="text-primary">.</span>
      </h2>
    </Reveal>
  );
}

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={webAppJsonLd({ name: SITE.name, description: SITE.description, url: SITE.url })}
      />
      <JsonLd data={faqJsonLd(HOME_FAQ)} />

      <Hero />

      <QrSpotlight />

      <FeaturedPair />

      <FavoritesSection />

      {/* Tools — browse by craft */}
      <section className="mx-auto w-full max-w-7xl px-6 py-16 sm:py-20" aria-labelledby="tools-heading">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <SectionHeader label="The toolkit" title="Find it by craft" id="tools-heading" />
          <Reveal>
            <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
              Ten small studios, one instant workflow. Input on one side, results on the other,
              live with every keystroke.
            </p>
          </Reveal>
        </div>
        {/* Desktop gets the wheel; narrow screens keep the row list below,
            which carries the same content without needing a pointer. */}
        <Reveal className="hidden lg:block">
          <CategoryWheel />
        </Reveal>

        {/* Display-scale rows rather than a grid of boxes: the category name is
            the object, everything else hangs off it. Colour comes from the same
            CATEGORY_ACCENT map the /tools pages use. */}
        <Reveal stagger className="border-border/60 flex flex-col border-b lg:hidden">
          {TOOL_CATEGORIES.map((category) => {
            const Icon = category.icon;
            const accent = accentFor(category.id);
            const featured = ["mockup", "logo3d", "codeshot", "invoice", "qr", "bgremover"];
            const picks = TOOLS.filter((t) => t.category === category.id)
              .slice()
              .sort((a, b) => {
                const ai = featured.indexOf(a.id);
                const bi = featured.indexOf(b.id);
                return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
              })
              .slice(0, 4);
            return (
              <div
                key={category.id}
                className="group border-border/60 relative isolate border-t py-6 lg:py-7"
              >
                {/* Wash bleeds past the container so the whole band lights up. */}
                <span
                  aria-hidden
                  className={`pointer-events-none absolute inset-y-0 -inset-x-6 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${accent.tint}`}
                />

                <div className="flex flex-col gap-x-10 gap-y-4 lg:flex-row lg:items-center">
                  <div className="lg:w-[42%] lg:shrink-0">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${accent.rule}`}
                      />
                      <h3 className="font-heading text-3xl leading-[1.05] font-bold tracking-tight sm:text-4xl lg:text-[2.75rem]">
                        <Link
                          href={`/tools#cat-${category.id}`}
                          className="after:absolute after:inset-0"
                        >
                          {category.label}
                        </Link>
                        <span className={accent.text}>.</span>
                      </h3>
                    </div>
                  </div>

                  <p className="text-muted-foreground max-w-md text-[13px] leading-relaxed lg:flex-1 lg:text-sm">
                    {category.description}
                  </p>

                  <div className="flex items-center gap-4 lg:shrink-0">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] tracking-[0.08em]">
                      {picks.map((tool, j) => (
                        <Fragment key={tool.id}>
                          {j > 0 && (
                            <span className="text-border" aria-hidden>
                              /
                            </span>
                          )}
                          <Link
                            href={tool.slug}
                            className={`text-muted-foreground relative z-10 transition-colors ${accent.linkHover}`}
                          >
                            {tool.shortName}
                          </Link>
                        </Fragment>
                      ))}
                    </div>
                    <Icon
                      className={`hidden size-5 shrink-0 transition-all duration-300 group-hover:translate-x-1 lg:block ${accent.text}`}
                      aria-hidden
                      strokeWidth={1.5}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </Reveal>
        <Reveal className="mt-10 flex justify-center">
          <Button asChild size="lg" variant="outline" className="h-11 rounded-full px-7 font-semibold">
            <Link href="/tools">
              Show all tools
              <ArrowRightIcon className="size-4" aria-hidden />
            </Link>
          </Button>
        </Reveal>
      </section>

      <HowItWorks />

      {/* Why Forma. Free leads; privacy and speed support it. Deliberately not
          three equal cards: the whole point is that one of them matters most. */}
      <section className="border-border/70 border-t" aria-labelledby="principles-heading">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
          <div className="grid gap-x-16 gap-y-12 lg:grid-cols-12">
            <Reveal className="lg:col-span-7">
              <p className="text-muted-foreground/70 text-xs font-medium tracking-wide">
                Why Forma
              </p>
              <h2
                id="principles-heading"
                className="font-heading mt-2 text-4xl font-bold tracking-tight sm:text-5xl"
              >
                It&rsquo;s free. That&rsquo;s the whole model
                <span className="text-primary">.</span>
              </h2>
              <p className="text-muted-foreground mt-5 max-w-lg leading-relaxed">
                There is no upgrade page, because there is no upgrade. Forma is lean to run, so
                there is no cost to pass on to you.
              </p>
              <Link
                href="/faq"
                className="group/faq text-foreground mt-6 inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
              >
                Read the FAQ
                <ArrowRightIcon
                  className="size-3.5 transition-transform group-hover/faq:translate-x-0.5"
                  aria-hidden
                />
              </Link>

              {/* Kept in this column rather than in a row underneath, so the
                  copy side carries the same vertical weight as the receipt. */}
              <div className="border-border/60 mt-10 grid gap-x-12 gap-y-7 border-t pt-8 sm:grid-cols-2">
                {PRINCIPLES.map((item) => (
                  <div key={item.title}>
                    <h3 className="font-heading text-base font-semibold tracking-tight">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground mt-2 text-[13px] leading-relaxed">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal className="lg:col-span-5 lg:flex lg:justify-end">
              <FreeReceipt />
            </Reveal>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-border/70 border-t" aria-labelledby="faq-heading">
        <div className="mx-auto max-w-7xl gap-12 px-6 py-24 lg:grid lg:grid-cols-[1fr_1.6fr]">
          <SectionHeader
            label="FAQ"
            title="Good questions, honest answers"
            id="faq-heading"
            className="mb-10 lg:mb-0"
          />
          <Reveal>
            <Accordion
              type="single"
              collapsible
              className="border-border/60 bg-card w-full rounded-2xl border px-6"
            >
              {HOME_FAQ.map((item, i) => (
                <AccordionItem key={item.question} value={`item-${i}`} className="last:border-b-0">
                  <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <p className="text-muted-foreground mt-6 text-sm">
              More questions?{" "}
              <Link href="/faq" className="text-foreground underline underline-offset-4">
                Read the full FAQ
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* CTA — Swiss closing statement */}
      <section className="border-border/70 border-t">
        <Reveal className="mx-auto grid max-w-7xl gap-10 px-6 py-28 sm:grid-cols-12 sm:items-end">
          <h2 className="font-heading text-5xl font-bold tracking-tight sm:col-span-8 sm:text-7xl">
            Pick a tool<span className="text-primary">.</span>
            <br />
            Get to work<span className="text-primary">.</span>
          </h2>
          <div className="flex flex-col items-start gap-4 sm:col-span-4 sm:items-end">
            <Button asChild size="lg" className="h-12 rounded-full px-8 text-base font-semibold">
              <Link href="/tools">Browse all tools</Link>
            </Button>
            <p className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
              Free / Private / No sign-up
            </p>
          </div>
        </Reveal>
      </section>
    </>
  );
}
