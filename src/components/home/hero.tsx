"use client";

import * as React from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Button } from "@/components/ui/button";
import { LinkLoadingIndicator } from "@/components/shared/link-indicator";
import { TOOLS } from "@/constants/tools";

gsap.registerPlugin(useGSAP);

const WORDMARK = ["f", "o", "r", "m", "a", "."];

export function Hero() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const marqueeTween = React.useRef<gsap.core.Tween | null>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({ defaults: { ease: "power4.out" } })
          .from("[data-hero-char]", { yPercent: 110, duration: 1.15, stagger: 0.05 }, 0)
          .from(
            "[data-hero-rule]",
            { scaleX: 0, transformOrigin: "left center", duration: 1, ease: "power3.inOut" },
            0.35
          )
          .from("[data-hero-row] > *", { y: 16, autoAlpha: 0, duration: 0.7, stagger: 0.1 }, 0.6)
          .from("[data-hero-marquee]", { autoAlpha: 0, duration: 0.8, ease: "power2.out" }, 0.85);

        // Two identical halves inside the track, so -50% loops seamlessly.
        marqueeTween.current = gsap.to("[data-hero-track]", {
          xPercent: -50,
          ease: "none",
          duration: 32,
          repeat: -1,
        });
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      aria-label="Forma — The everyday tool studio"
      className="relative overflow-hidden"
    >
      {/* Faded dot grid, weighted to the top-left like the composition */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-[size:22px_22px] [mask-image:radial-gradient(ellipse_65%_70%_at_30%_25%,black,transparent)]"
      />

      <div className="mx-auto w-full max-w-7xl px-6 pt-24 sm:pt-32">
        {/* Wordmark — flush left, each character rising out of its own mask */}
        <h1
          aria-label="forma."
          className="font-heading flex text-[clamp(4.5rem,15vw,13rem)] leading-[0.85] font-bold tracking-[-0.05em]"
        >
          {WORDMARK.map((char, i) => (
            <span key={i} aria-hidden className="block overflow-hidden pb-[0.08em]">
              <span data-hero-char className={char === "." ? "text-primary block" : "block"}>
                {char}
              </span>
            </span>
          ))}
        </h1>

        {/* Asymmetric bottom row on a second hairline */}
        <div data-hero-rule className="bg-border mt-12 h-px w-full" aria-hidden />
        <div data-hero-row className="grid gap-6 pt-7 pb-16 sm:grid-cols-12 sm:items-baseline">
          <p className="font-heading text-xl font-medium tracking-tight sm:col-span-7 sm:text-2xl">
            Tools for developers
            <br />
            and designers.
          </p>
          <div className="flex flex-wrap items-center gap-6 sm:col-span-5 sm:justify-end">
            <Button asChild size="lg" className="h-11 rounded-full px-7 font-semibold">
              <Link href="/tools">Browse all tools</Link>
            </Button>
            <Link
              href="/tools/universal"
              className="text-foreground inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
            >
              Universal
              <LinkLoadingIndicator />
            </Link>
          </div>
        </div>
      </div>

      {/* Tool-name marquee — decorative; the real list lives in the grid below. */}
      <div
        data-hero-marquee
        aria-hidden
        className="border-border/70 overflow-hidden border-y py-4"
        onMouseEnter={() => marqueeTween.current?.pause()}
        onMouseLeave={() => marqueeTween.current?.play()}
      >
        <div data-hero-track className="flex w-max">
          {[0, 1].map((half) => (
            <div
              key={half}
              className="text-muted-foreground flex shrink-0 items-center font-mono text-xs tracking-[0.2em] uppercase"
            >
              {TOOLS.map((tool) => (
                <span key={tool.id} className="flex items-center">
                  <span className="px-5">{tool.shortName}</span>
                  <span className="bg-primary size-1 rounded-full" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
