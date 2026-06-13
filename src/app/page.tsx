import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { FavoritesSection } from "@/components/home/favorites-section";
import { Hero } from "@/components/home/hero";
import { Reveal } from "@/components/home/reveal";
import { JsonLd, faqJsonLd, webAppJsonLd } from "@/components/shared/json-ld";
import { ToolGrid } from "@/components/shared/tool-grid";
import { FAQ_ITEMS } from "@/constants/faq";
import { SITE } from "@/constants/site";

const HOME_FAQ = FAQ_ITEMS.slice(0, 5);

const STEPS = [
  {
    title: "Pick a tool",
    text: "Generators, converters, color and image editors — every tool shares one consistent, instant workflow.",
  },
  {
    title: "Type, and it's done",
    text: "No submit buttons, no waiting. Your result renders live with every keystroke, validated as you go.",
  },
  {
    title: "Copy and ship",
    text: "Copy the result, download your files, or export ready-made CSS, HTML, React and Markdown snippets.",
  },
];

const PRINCIPLES = [
  {
    title: "Private by design",
    text: "Your input is used only to generate your output. No accounts, no ad pixels, no analytics watching what you type — nothing is logged or sold.",
  },
  {
    title: "Works offline",
    text: "Forma installs as a PWA and keeps working with no connection at all. On a plane, in a basement, behind a firewall.",
  },
  {
    title: "Free, with no catch",
    text: "No sign-ups, no watermarks, no expiring links. Static QR codes encode your data directly and keep working forever.",
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
      <p className="text-muted-foreground flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase">
        <span className="bg-primary h-px w-6" aria-hidden />
        {label}
      </p>
      <h2 id={id} className="font-heading mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
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

      <FavoritesSection />

      {/* Tools */}
      <section className="mx-auto w-full max-w-7xl px-4 py-24" aria-labelledby="tools-heading">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <SectionHeader label="The toolkit" title="One workflow, every tool" id="tools-heading" />
          <Reveal>
            <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
              Every tool shares the same instant workflow — input on one side, results on the
              other, nothing uploaded anywhere.
            </p>
          </Reveal>
        </div>
        <ToolGrid />
      </section>

      {/* How it works — editorial numbered rows */}
      <section className="border-border/70 border-t" aria-labelledby="how-heading">
        <div className="mx-auto max-w-7xl px-4 py-24">
          <SectionHeader
            label="How it works"
            title="From input to output in seconds"
            id="how-heading"
            className="mb-14"
          />
          <Reveal stagger className="flex flex-col">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="border-border group grid items-baseline gap-x-8 gap-y-3 border-t py-8 last:border-b sm:grid-cols-[80px_1fr_1.4fr]"
              >
                <span className="font-heading text-primary/30 group-hover:text-primary text-4xl font-bold tracking-tight transition-colors sm:text-5xl">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-heading text-2xl font-semibold tracking-tight">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
                  {step.text}
                </p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Principles — cards */}
      <section className="border-border/70 border-t" aria-labelledby="principles-heading">
        <div className="mx-auto max-w-7xl px-4 py-24">
          <SectionHeader
            label="Why Forma"
            title="Private by design, not by promise"
            id="principles-heading"
            className="mb-14"
          />
          <Reveal stagger className="grid gap-4 sm:grid-cols-3">
            {PRINCIPLES.map((item) => (
              <div
                key={item.title}
                className="border-border/60 bg-card hover:border-primary/30 rounded-2xl border p-7 transition-colors"
              >
                <span className="bg-primary inline-block size-2 rounded-full" aria-hidden />
                <h3 className="font-heading mt-5 text-xl font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="text-muted-foreground mt-2.5 text-sm leading-relaxed">{item.text}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-border/70 border-t" aria-labelledby="faq-heading">
        <div className="mx-auto max-w-7xl gap-12 px-4 py-24 lg:grid lg:grid-cols-[1fr_1.6fr]">
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
        <Reveal className="mx-auto grid max-w-7xl gap-10 px-4 py-28 sm:grid-cols-12 sm:items-end">
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
              Free / Private / On-device
            </p>
          </div>
        </Reveal>
      </section>
    </>
  );
}
