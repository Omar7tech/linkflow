"use client";

import * as React from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Button } from "@/components/ui/button";

gsap.registerPlugin(useGSAP);

export function Hero() {
  const sectionRef = React.useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-hero-content] > *", {
          y: 15,
          autoAlpha: 0,
          duration: 0.7,
          stagger: 0.1,
          ease: "power2.out",
        });
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="flex flex-col"
      aria-label="LinkFlow — Tools for all"
    >
      <div className="mx-auto w-full max-w-7xl px-6 pt-40 pb-24">
        <div data-hero-content className="flex flex-col items-start gap-8">
          {/* Main Headline */}
          <h1 className="font-heading max-w-4xl text-[clamp(3.5rem,12vw,8rem)] leading-[0.9] font-bold tracking-[-0.06em]">
            <span className="text-primary block">LinkFlow.</span>
            <span className="block">Tools for all.</span>
          </h1>

          {/* Subtext */}
          <p className="text-muted-foreground max-w-2xl text-xl leading-snug font-medium tracking-tight sm:text-2xl">
            A refined collection of essential utilities for the modern web. 
            Simple, fast, and entirely private.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-md px-8 text-base font-bold tracking-tight shadow-lg shadow-primary/10 transition-all hover:-translate-y-0.5 active:translate-y-0">
              <Link href="/tools/universal">
                Explore Tools
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="h-12 rounded-md px-8 text-base font-bold tracking-tight transition-all hover:bg-secondary/80">
              <Link href="/tools">
                View All
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
