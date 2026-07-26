import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, HelpCircleIcon } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { JsonLd, faqJsonLd } from "@/components/shared/json-ld";
import { FAQ_ITEMS } from "@/constants/faq";
import { SITE } from "@/constants/site";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about Forma's privacy model, accounts, uploaded files, QR code longevity, export formats, WhatsApp link formatting, UTM best practices and more.",
  alternates: { canonical: `${SITE.url}/faq` },
};

export default function FaqPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
      <JsonLd data={faqJsonLd(FAQ_ITEMS)} />

      <div className="grid gap-12 lg:grid-cols-[0.85fr_1.6fr] lg:gap-16">
        {/* Intro — sticky on desktop */}
        <header className="lg:sticky lg:top-24 lg:self-start">
          <p className="flex items-center gap-2 font-mono text-xs font-medium tracking-[0.2em] text-emerald-700 uppercase dark:text-emerald-400">
            <HelpCircleIcon className="size-3.5" aria-hidden />
            FAQ
          </p>
          <h1 className="font-heading mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Good questions,
            <br className="hidden sm:block" /> honest answers
            <span className="text-primary">.</span>
          </h1>
          <p className="text-muted-foreground mt-4 max-w-sm text-sm leading-relaxed">
            Everything worth knowing about how Forma works — what it does with your data, and what it
            never does.
          </p>

          <div className="border-border/60 bg-card mt-8 rounded-2xl border p-5">
            <p className="font-heading text-sm font-semibold">Still stuck?</p>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              The fastest answer is usually to just open the tool and try it.
            </p>
            <Button asChild variant="outline" size="sm" className="group mt-4 rounded-full">
              <Link href="/tools">
                Browse the tools
                <ArrowRightIcon
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </Button>
          </div>
        </header>

        {/* Questions */}
        <Accordion
          type="single"
          collapsible
          className="border-border/60 bg-card h-fit w-full rounded-2xl border px-5 sm:px-6"
        >
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={item.question} value={`item-${i}`} className="last:border-b-0">
              <AccordionTrigger className="text-left text-base font-semibold">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
