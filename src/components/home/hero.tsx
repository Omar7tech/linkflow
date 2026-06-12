"use client";

import * as React from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

gsap.registerPlugin(useGSAP);

const MARKS = ["No accounts", "No uploads", "No tracking", "Works offline"];

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
      className="relative flex flex-col overflow-hidden"
      aria-label="Forma — The everyday tool studio"
    >
      {/* Ambient glow — pure CSS, GPU-composited */}
      <div
        className="bg-primary/10 pointer-events-none absolute -top-32 right-[-10%] size-[480px] rounded-full blur-[120px]"
        aria-hidden
      />

      <div className="mx-auto w-full max-w-7xl px-6 pt-36 pb-24">
        <div data-hero-content className="flex flex-col items-start gap-8">
          {/* Eyebrow */}
          <p className="border-border/70 bg-card/50 text-muted-foreground flex items-center gap-2.5 rounded-full border px-4 py-1.5 font-mono text-[11px] tracking-[0.22em] uppercase">
            <span className="relative flex size-1.5" aria-hidden>
              <span className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:hidden" />
              <span className="bg-primary relative inline-flex size-1.5 rounded-full" />
            </span>
            Forma — The everyday tool studio
          </p>

          {/* Main Headline */}
          <h1 className="font-heading max-w-5xl text-[clamp(3.25rem,11vw,7.5rem)] leading-[0.92] font-bold tracking-[-0.05em]">
            Form follows
            <span className="text-primary block">function.</span>
          </h1>

          {/* Subtext */}
          <p className="text-muted-foreground max-w-2xl text-xl leading-snug font-medium tracking-tight sm:text-2xl">
            Precision tools for links, QR codes, color, type and images. Free and instant —
            everything runs on your device, nothing ever leaves it.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="group h-12 rounded-full px-8 text-base font-bold tracking-tight shadow-lg shadow-primary/15 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Link href="/tools">
                Browse the studio
                <ArrowRightIcon className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-12 rounded-full px-6 text-base font-bold tracking-tight"
            >
              <Link href="/tools/universal">Try the universal generator</Link>
            </Button>
          </div>

          {/* Promise strip */}
          <ul className="text-muted-foreground mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] tracking-[0.18em] uppercase">
            {MARKS.map((mark) => (
              <li key={mark} className="flex items-center gap-2">
                <span className="bg-primary/60 size-1 rounded-full" aria-hidden />
                {mark}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
