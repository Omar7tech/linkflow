import Link from "next/link";
import {
  LockIcon,
  MousePointerClickIcon,
  ShieldCheckIcon,
  SparklesIcon,
  WifiOffIcon,
  ZapIcon,
} from "lucide-react";
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

const STATS = [
  { value: "9", label: "focused generators" },
  { value: "0", label: "bytes sent to a server" },
  { value: "100%", label: "client-side, forever" },
  { value: "∞", label: "links — they never expire" },
];

const STEPS = [
  {
    icon: MousePointerClickIcon,
    title: "Pick a tool",
    text: "WhatsApp links, QR codes, share buttons, vCards, UTM URLs — nine focused generators, one consistent workflow.",
  },
  {
    icon: ZapIcon,
    title: "Type, and it's done",
    text: "No submit buttons. Your link and QR code render live with every keystroke, validated as you go.",
  },
  {
    icon: SparklesIcon,
    title: "Copy, embed, share",
    text: "Grab the link, download the QR as PNG or SVG, or export ready-made HTML, React and Markdown snippets.",
  },
];

const TRUST = [
  {
    icon: ShieldCheckIcon,
    title: "100% private",
    text: "Everything is generated on your device. Nothing you type ever leaves your browser — there is no backend at all.",
  },
  {
    icon: WifiOffIcon,
    title: "Works offline",
    text: "Installable PWA — the generators keep working with no connection, on a plane or in a basement.",
  },
  {
    icon: LockIcon,
    title: "No accounts, no limits",
    text: "Free forever. No sign-ups, no watermarks, no 'your QR expires in 14 days' ransom emails.",
  },
];

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={webAppJsonLd({ name: SITE.name, description: SITE.description, url: SITE.url })}
      />
      <JsonLd data={faqJsonLd(HOME_FAQ)} />

      <Hero />

      {/* Stats band */}
      <section aria-label="LinkFlow in numbers" className="border-border/60 border-b">
        <Reveal stagger className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-8 px-4 py-12 md:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-heading text-4xl font-bold sm:text-5xl">{stat.value}</p>
              <p className="text-muted-foreground mt-1.5 text-xs sm:text-sm">{stat.label}</p>
            </div>
          ))}
        </Reveal>
      </section>

      {/* Tool grid */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20" aria-labelledby="tools-heading">
        <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-primary mb-2 font-mono text-xs tracking-widest uppercase">The toolkit</p>
            <h2 id="tools-heading" className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Nine tools, one workflow
            </h2>
          </div>
          <p className="text-muted-foreground max-w-sm text-sm">
            Every generator shares the same instant-preview experience: type on the left, copy on
            the right.
          </p>
        </Reveal>
        <ToolGrid animated />
      </section>

      {/* How it works */}
      <section className="border-border/60 relative overflow-hidden border-y" aria-labelledby="how-heading">
        <div
          aria-hidden
          className="bg-primary/10 absolute top-0 left-1/2 size-100 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20">
          <Reveal className="mb-12 text-center">
            <p className="text-primary mb-2 font-mono text-xs tracking-widest uppercase">How it works</p>
            <h2 id="how-heading" className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              From idea to link in seconds
            </h2>
          </Reveal>
          <Reveal stagger className="grid gap-5 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="border-border bg-card/60 relative rounded-2xl border p-6 backdrop-blur-sm"
              >
                <span className="font-heading text-primary/15 absolute top-3 right-5 text-6xl font-bold select-none">
                  {i + 1}
                </span>
                <div className="border-border bg-muted/40 mb-4 flex size-11 items-center justify-center rounded-xl border">
                  <step.icon className="text-primary size-5" aria-hidden />
                </div>
                <h3 className="font-heading text-lg font-semibold">{step.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{step.text}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Trust */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20" aria-labelledby="trust-heading">
        <Reveal className="mb-12 text-center">
          <p className="text-primary mb-2 font-mono text-xs tracking-widest uppercase">Why LinkFlow</p>
          <h2 id="trust-heading" className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Private by architecture, not by promise
          </h2>
        </Reveal>
        <Reveal stagger className="grid gap-5 sm:grid-cols-3">
          {TRUST.map((item) => (
            <div
              key={item.title}
              className="group border-border bg-card/60 hover:border-primary/30 rounded-2xl border p-6 transition-colors"
            >
              <item.icon className="text-primary mb-4 size-6" aria-hidden />
              <h3 className="font-heading text-lg font-semibold">{item.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{item.text}</p>
            </div>
          ))}
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="border-border/60 border-t" aria-labelledby="faq-heading">
        <div className="mx-auto max-w-3xl px-4 py-20">
          <Reveal className="mb-8 text-center">
            <p className="text-primary mb-2 font-mono text-xs tracking-widest uppercase">FAQ</p>
            <h2 id="faq-heading" className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Good questions, honest answers
            </h2>
          </Reveal>
          <Reveal>
            <Accordion type="single" collapsible className="w-full">
              {HOME_FAQ.map((item, i) => (
                <AccordionItem key={item.question} value={`item-${i}`}>
                  <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <p className="text-muted-foreground mt-6 text-center text-sm">
              More questions?{" "}
              <Link href="/faq" className="text-foreground underline underline-offset-4">
                Read the full FAQ
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="border-border/60 noise relative overflow-hidden border-t">
        <div
          aria-hidden
          className="bg-primary/15 absolute bottom-0 left-1/2 size-130 -translate-x-1/2 translate-y-1/2 rounded-full blur-[140px]"
        />
        <Reveal className="relative mx-auto max-w-6xl px-4 py-24 text-center">
          <h2 className="font-heading text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            Your next link is <span className="text-gradient">ten seconds</span> away
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-balance">
            No account. No tracking. No expiring links. Just paste, preview and ship.
          </p>
          <Button asChild size="lg" className="glow mt-9 h-12 rounded-full px-8 text-base">
            <Link href="/universal">Open the Universal Generator</Link>
          </Button>
        </Reveal>
      </section>
    </>
  );
}
