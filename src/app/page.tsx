import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
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
    text: "WhatsApp links, QR codes, share buttons, vCards, UTM URLs, passwords, favicons — fifteen focused generators, one consistent workflow.",
  },
  {
    title: "Type, and it's done",
    text: "No submit buttons. Your link and QR code render live with every keystroke, validated as you go.",
  },
  {
    title: "Copy, embed, share",
    text: "Grab the link, download the QR as PNG or SVG, or export ready-made HTML, React and Markdown snippets.",
  },
];

const PRINCIPLES = [
  {
    title: "Private by design",
    text: "Your input is used only to generate your output. No accounts, no ad pixels, no analytics watching what you type — nothing is logged or sold.",
  },
  {
    title: "Works offline",
    text: "LinkFlow installs as a PWA and keeps working with no connection at all. On a plane, in a basement, behind a firewall.",
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
      <p className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
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

      {/* Tools */}
      <section className="mx-auto w-full max-w-6xl px-4 py-24" aria-labelledby="tools-heading">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <SectionHeader label="01 — The toolkit" title="Fifteen tools, one workflow" id="tools-heading" />
          <Reveal>
            <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
              Every generator shares the same instant-preview experience: type on the left, copy on
              the right.
            </p>
          </Reveal>
        </div>
        <ToolGrid animated />
      </section>

      {/* How it works */}
      <section className="border-border/70 border-t" aria-labelledby="how-heading">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <SectionHeader
            label="02 — How it works"
            title="From idea to link in seconds"
            id="how-heading"
            className="mb-14"
          />
          <Reveal stagger className="grid gap-x-8 gap-y-12 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="border-border border-t pt-6">
                <span className="text-muted-foreground font-mono text-[11px] tracking-[0.18em]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-heading mt-5 text-xl font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="text-muted-foreground mt-2.5 text-sm leading-relaxed">{step.text}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Principles */}
      <section className="border-border/70 border-t" aria-labelledby="principles-heading">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <SectionHeader
            label="03 — Why LinkFlow"
            title="Private by design, not by promise"
            id="principles-heading"
            className="mb-14"
          />
          <Reveal stagger className="grid gap-x-8 gap-y-12 sm:grid-cols-3">
            {PRINCIPLES.map((item) => (
              <div key={item.title} className="border-border border-t pt-6">
                <h3 className="font-heading text-xl font-semibold tracking-tight">{item.title}</h3>
                <p className="text-muted-foreground mt-2.5 text-sm leading-relaxed">{item.text}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-border/70 border-t" aria-labelledby="faq-heading">
        <div className="mx-auto max-w-6xl gap-12 px-4 py-24 lg:grid lg:grid-cols-[1fr_1.6fr]">
          <SectionHeader
            label="04 — FAQ"
            title="Good questions, honest answers"
            id="faq-heading"
            className="mb-10 lg:mb-0"
          />
          <Reveal>
            <Accordion type="single" collapsible className="w-full">
              {HOME_FAQ.map((item, i) => (
                <AccordionItem key={item.question} value={`item-${i}`}>
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

      {/* CTA */}
      <section className="border-border/70 border-t">
        <Reveal className="mx-auto max-w-6xl px-4 py-28">
          <p className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
            Start now
          </p>
          <h2 className="font-heading mt-4 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            Your next link is <span className="text-primary">ten seconds</span> away.
          </h2>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
              <Link href="/universal">Open the Universal Generator</Link>
            </Button>
            <p className="text-muted-foreground text-sm">No account. No tracking. No expiry.</p>
          </div>
        </Reveal>
      </section>
    </>
  );
}
