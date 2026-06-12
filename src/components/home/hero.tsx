"use client";

import * as React from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Button } from "@/components/ui/button";
import { LinkLoadingIndicator } from "@/components/shared/link-indicator";

gsap.registerPlugin(useGSAP);

const HEADLINE_LINES = [
  { text: "Form follows", accent: false },
  { text: "function.", accent: true },
];

export function Hero() {
  const sectionRef = React.useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({ defaults: { ease: "power4.out" } })
          .from("[data-hero-eyebrow]", { y: 12, autoAlpha: 0, duration: 0.6 })
          .from(
            "[data-hero-line]",
            { yPercent: 110, duration: 1.1, stagger: 0.12 },
            0.1
          )
          .from(
            "[data-hero-rule]",
            {
              scaleX: 0,
              transformOrigin: "left center",
              duration: 1.1,
              ease: "power3.inOut",
            },
            0.55
          )
          .from(
            "[data-hero-bottom] > *",
            { y: 18, autoAlpha: 0, duration: 0.7, stagger: 0.1, ease: "power3.out" },
            0.8
          );
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} aria-label="Forma — The everyday tool studio">
      <div className="mx-auto w-full max-w-7xl px-6 pt-32 pb-24 sm:pt-44">
        <p
          data-hero-eyebrow
          className="text-muted-foreground font-mono text-[11px] tracking-[0.22em] uppercase"
        >
          The everyday tool studio
        </p>

        {/* Each line sits in an overflow-hidden mask and slides up into view. */}
        <h1 className="font-heading mt-8 text-[clamp(3.5rem,12.5vw,9rem)] leading-[0.95] font-bold tracking-[-0.05em]">
          {HEADLINE_LINES.map((line) => (
            <span key={line.text} className="block overflow-hidden pb-[0.08em]">
              <span data-hero-line className={line.accent ? "text-primary block" : "block"}>
                {line.text}
              </span>
            </span>
          ))}
        </h1>

        <div data-hero-rule className="bg-border mt-20 h-px w-full" aria-hidden />

        <div data-hero-bottom className="mt-10 grid gap-10 sm:grid-cols-2 sm:items-end">
          <p className="text-muted-foreground max-w-md text-base leading-relaxed sm:text-lg">
            Precision tools for links, QR codes, color, type and images — free, instant, and
            entirely on your device.
          </p>
          <div className="flex flex-wrap items-center gap-7 sm:justify-end">
            <Button asChild size="lg" className="h-11 rounded-full px-7 font-semibold">
              <Link href="/tools">Browse all tools</Link>
            </Button>
            <Link
              href="/tools/universal"
              className="text-foreground inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
            >
              Universal generator
              <LinkLoadingIndicator />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
