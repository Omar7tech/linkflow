import type { Metadata } from "next";
import Link from "next/link";
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
    "Answers about LinkFlow's privacy model, QR code longevity, WhatsApp link formatting, UTM best practices and offline support.",
  alternates: { canonical: `${SITE.url}/faq` },
};

export default function FaqPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <JsonLd data={faqJsonLd(FAQ_ITEMS)} />
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Frequently asked questions</h1>
        <p className="text-muted-foreground mt-2">
          Everything you might want to know about how LinkFlow works — and what it never does with
          your data.
        </p>
      </header>
      <Accordion type="single" collapsible className="w-full">
        {FAQ_ITEMS.map((item, i) => (
          <AccordionItem key={item.question} value={`item-${i}`}>
            <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <div className="mt-10 text-center">
        <Button asChild>
          <Link href="/tools">Browse the tools</Link>
        </Button>
      </div>
    </div>
  );
}
