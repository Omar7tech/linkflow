"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Button } from "@/components/ui/button";
import { LinkLoadingIndicator } from "@/components/shared/link-indicator";
import SideRays from "./side-rays";

gsap.registerPlugin(useGSAP);

const WORDMARK = ["f", "o", "r", "m", "a", "."];

export function Hero() {
  const sectionRef = React.useRef<HTMLElement>(null);

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
          .from(
            "[data-hero-art]",
            { autoAlpha: 0, scale: 0.6, rotate: -12, y: 40, duration: 1, ease: "back.out(1.5)" },
            0.4
          );

        // Gentle continuous float — transform only, no layout/paint cost.
        gsap.to("[data-hero-art]", {
          y: -14,
          rotate: 3,
          duration: 3.2,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          delay: 1.6,
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
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-[size:22px_22px] mask-[radial-gradient(ellipse_65%_70%_at_30%_25%,black,transparent)]"
      />

      {/* WebGL light rays from the top-right. Dark mode only — additive light
          glow doesn't read well against a white background. */}
      <div
        aria-hidden
        className="absolute top-0 right-0 -z-10 hidden h-[420px] w-full sm:h-[520px] sm:w-[70%] dark:block mask-[radial-gradient(ellipse_90%_95%_at_100%_0%,black_55%,transparent_92%)]"
      >
        <SideRays
          speed={2}
          rayColor1="#34d399"
          rayColor2="#5eead4"
          intensity={2.4}
          spread={3}
          origin="top-right"
          saturation={1.5}
          blend={0.6}
          falloff={1.5}
          opacity={0.9}
        />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-6 pt-24 sm:pt-32">
        {/* Floating 3D craft icon — anchored top-right, clear of the flush-left wordmark */}
        <Image
          src="/images/3d-rendering-mechanism-bulb-icon.png"
          alt=""
          data-hero-art
          width={512}
          height={512}
          priority
          className="pointer-events-none absolute top-6 right-4 z-0 hidden w-36 drop-shadow-xl select-none sm:top-10 sm:right-6 md:block lg:w-52 xl:w-60"
        />

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
    </section>
  );
}
