"use client";

import * as React from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TOOLS } from "@/constants/tools";

gsap.registerPlugin(useGSAP);

const DATA_POINTS = [
  { value: 13, pad: true, label: "Focused generators" },
  { value: 0, pad: true, label: "Sign-ups required" },
  { value: 100, suffix: "%", label: "Free, always" },
  { value: null, display: "∞", label: "Links — never expire" },
];

export function Hero() {
  const sectionRef = React.useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

        tl.from("[data-hero-line]", {
          yPercent: 112,
          duration: 1.05,
          stagger: 0.11,
        })
          .from(
            "[data-hero-fade]",
            { y: 18, autoAlpha: 0, duration: 0.7, stagger: 0.1 },
            "-=0.6"
          )
          .from(
            "[data-hero-rule]",
            { scaleX: 0, transformOrigin: "left center", duration: 0.9, ease: "power2.inOut" },
            "-=0.5"
          );

        // Count-up on the data row.
        gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
          const target = Number(el.dataset.count);
          const pad = el.dataset.pad === "true";
          const suffix = el.dataset.suffix ?? "";
          const state = { v: 0 };
          gsap.to(state, {
            v: target,
            duration: 1.4,
            delay: 0.7,
            ease: "power2.out",
            onUpdate: () => {
              const n = Math.round(state.v);
              el.textContent = (pad ? String(n).padStart(2, "0") : String(n)) + suffix;
            },
          });
        });
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="flex min-h-[88svh] flex-col"
      aria-label="LinkFlow — create, share, connect"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pt-20 pb-14">
        {/* Meta row */}
        <div
          data-hero-fade
          className="text-muted-foreground flex items-baseline justify-between font-mono text-[11px] tracking-[0.18em] uppercase"
        >
          <span>Link &amp; QR toolkit</span>
          <span className="hidden sm:inline">Free — no sign-up — no tracking</span>
        </div>

        {/* Headline */}
        <h1 className="font-heading mt-8 text-[clamp(3.4rem,12.5vw,9.5rem)] leading-[0.92] font-bold tracking-[-0.03em]">
          <span className="block overflow-hidden">
            <span data-hero-line className="block">
              Create.
            </span>
          </span>
          <span className="block overflow-hidden">
            <span data-hero-line className="block">
              Share.
            </span>
          </span>
          <span className="block overflow-hidden pb-[0.08em]">
            <span data-hero-line className="text-primary block">
              Connect.
            </span>
          </span>
        </h1>

        {/* Sub + CTAs */}
        <div className="mt-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <p data-hero-fade className="text-muted-foreground max-w-md text-base leading-relaxed sm:text-lg">
            WhatsApp links, QR codes, digital business cards and campaign URLs — generated
            instantly. No sign-up, no tracking, nothing logged.
          </p>
          <div data-hero-fade className="flex shrink-0 flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-11 rounded-full px-6">
              <Link href="/universal">
                Start creating <ArrowRightIcon />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="h-11 rounded-full px-5">
              <Link href="/tools">All tools</Link>
            </Button>
          </div>
        </div>

        {/* Data row */}
        <div data-hero-rule className="bg-border mt-14 h-px w-full" aria-hidden />
        <dl className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
          {DATA_POINTS.map((point) => (
            <div key={point.label} data-hero-fade>
              <dd className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                {point.value === null ? (
                  point.display
                ) : (
                  <span
                    data-count={point.value}
                    data-pad={point.pad ? "true" : "false"}
                    data-suffix={point.suffix ?? ""}
                  >
                    {point.pad ? String(point.value).padStart(2, "0") : point.value}
                    {point.suffix ?? ""}
                  </span>
                )}
              </dd>
              <dt className="text-muted-foreground mt-1.5 font-mono text-[11px] tracking-[0.14em] uppercase">
                {point.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>

      {/* Marquee */}
      <div data-hero-fade className="border-border/70 border-t py-4">
        <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
          <div className="animate-marquee motion-reduce:animate-none flex w-max items-center gap-12 whitespace-nowrap">
            {[0, 1].map((copy) => (
              <div key={copy} aria-hidden={copy === 1} className="flex items-center gap-12">
                {TOOLS.map((tool) => (
                  <span
                    key={tool.id}
                    className="text-muted-foreground flex items-center gap-12 font-mono text-xs tracking-[0.14em] uppercase"
                  >
                    {tool.name}
                    <span className="text-primary">·</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
