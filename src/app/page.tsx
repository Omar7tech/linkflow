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
import { FadeIn } from "@/components/shared/fade-in";
import { JsonLd, faqJsonLd, webAppJsonLd } from "@/components/shared/json-ld";
import { ToolGrid } from "@/components/shared/tool-grid";
import { FAQ_ITEMS } from "@/constants/faq";
import { SITE } from "@/constants/site";

const HOME_FAQ = FAQ_ITEMS.slice(0, 5);

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
    text: "Everything is generated on your device. Nothing you type ever leaves your browser.",
  },
  {
    icon: WifiOffIcon,
    title: "Works offline",
    text: "Installable PWA — generators keep working with no connection at all.",
  },
  {
    icon: LockIcon,
    title: "No accounts, no limits",
    text: "Free forever. No sign-ups, no watermarks, no expiring links.",
  },
];

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={webAppJsonLd({ name: SITE.name, description: SITE.description, url: SITE.url })}
      />
      <JsonLd data={faqJsonLd(HOME_FAQ)} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="from-primary/10 pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b to-transparent"
        />
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:pt-24 sm:pb-16">
          <FadeIn>
            <p className="border-border bg-muted/40 text-muted-foreground mx-auto mb-5 w-fit rounded-full border px-3 py-1 text-xs font-medium">
              Free · No sign-up · Runs entirely in your browser
            </p>
          </FadeIn>
          <FadeIn delay={0.05}>
            <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
              Create, Share, <span className="text-primary">Connect.</span>
            </h1>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-base text-balance sm:text-lg">
              The link &amp; QR toolkit for marketers, makers and small businesses. WhatsApp links,
              custom QR codes, digital business cards and campaign URLs — generated instantly,
              privately, forever free.
            </p>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/universal">Start generating</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/tools">Browse all tools</Link>
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Tool grid */}
      <section className="mx-auto w-full max-w-6xl px-4 py-12" aria-labelledby="tools-heading">
        <div className="mb-8 text-center">
          <h2 id="tools-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Nine tools, one workflow
          </h2>
          <p className="text-muted-foreground mt-2">
            Every generator shares the same instant-preview experience.
          </p>
        </div>
        <ToolGrid />
      </section>

      {/* How it works */}
      <section className="border-border/60 border-y" aria-labelledby="how-heading">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 id="how-heading" className="mb-10 text-center text-2xl font-bold tracking-tight sm:text-3xl">
            How it works
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="text-center">
                <div className="border-border bg-muted/40 mx-auto mb-4 flex size-12 items-center justify-center rounded-xl border">
                  <step.icon className="size-5" aria-hidden />
                </div>
                <h3 className="font-semibold">
                  <span className="text-muted-foreground mr-1.5 font-mono text-sm">{i + 1}.</span>
                  {step.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14" aria-labelledby="trust-heading">
        <h2 id="trust-heading" className="sr-only">
          Why LinkFlow
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {TRUST.map((item) => (
            <div key={item.title} className="border-border bg-card rounded-xl border p-5">
              <item.icon className="text-primary mb-3 size-5" aria-hidden />
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-muted-foreground mt-1.5 text-sm">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="border-border/60 border-t" aria-labelledby="faq-heading">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 id="faq-heading" className="mb-6 text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Frequently asked questions
          </h2>
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
        </div>
      </section>

      {/* CTA */}
      <section className="border-border/60 border-t">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Your next link is ten seconds away
          </h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-xl">
            No account. No tracking. No expiring links. Just paste, preview and ship.
          </p>
          <Button asChild size="lg" className="mt-7">
            <Link href="/universal">Open the Universal Generator</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
