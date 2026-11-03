"use client";

import * as React from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRightIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { TM_GLYPHS, TM_VIEWBOX } from "@/components/shared/logo";
import { TwoMindsLogo } from "@/components/shared/two-minds-logo";
import AcidSquares from "./acid-squares";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const subscribeNever = () => () => undefined;

export function Hero() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const hydrated = React.useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const { resolvedTheme } = useTheme();
  const theme = hydrated ? resolvedTheme : undefined;

  useGSAP(
    () => {
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({ defaults: { ease: "power4.out" } })
          .from(
            "[data-hero-char]",
            { yPercent: 115, duration: 1.15, stagger: 0.05 },
            0.15,
          )
          .from(
            "[data-hero-byline]",
            { y: 8, autoAlpha: 0, duration: 0.7 },
            0.55,
          )
          .from(
            "[data-hero-line]",
            { y: 18, autoAlpha: 0, filter: "blur(8px)", duration: 1 },
            0.6,
          )
          .from("[data-hero-sub]", { y: 12, autoAlpha: 0, duration: 0.9 }, 0.75)
          .from(
            "[data-hero-finder]",
            { y: 16, autoAlpha: 0, duration: 0.9 },
            0.9,
          );

        // Leaving the hero: the words lift away and dim while the floor sinks
        // more slowly behind them, so the hand-off to the next section is a
        // drift rather than a hard edge.
        const exit = {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        };
        gsap.to("[data-hero-content]", {
          yPercent: -18,
          autoAlpha: 0.15,
          ease: "none",
          scrollTrigger: exit,
        });
        gsap.to("[data-hero-bg]", {
          yPercent: 12,
          scale: 1.04,
          ease: "none",
          scrollTrigger: exit,
        });
      });
    },
    { scope: sectionRef },
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[calc(100svh-3.5rem)] flex-col overflow-hidden"
    >
      <Field theme={theme} />

      {/* Words on the left; the light comes in from the right. */}
      <div
        data-hero-content
        className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-6 py-16"
      >
        <div className="max-w-2xl">
          <div className="w-[min(100%,36rem)]">
            <h1 id="hero-title" aria-label="TM TOOLS">
              <svg
                viewBox={TM_VIEWBOX}
                aria-hidden
                className="text-foreground tm-gears-spin block h-auto w-full overflow-hidden fill-current"
              >
                {TM_GLYPHS.map((glyph) => (
                  <g key={glyph.key} data-hero-char>
                    {glyph}
                  </g>
                ))}
              </svg>
            </h1>
            <p
              data-hero-byline
              className="text-muted-foreground mt-3 flex items-center justify-end gap-2.5 text-[11px] leading-none font-semibold tracking-[0.18em] sm:gap-3 sm:text-xs"
            >
              BY
              <a
                href="https://twomindsengine.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Two Minds Engine (opens in a new tab)"
                className="hover:text-foreground focus-visible:ring-ring rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <TwoMindsLogo className="block h-4 sm:h-5" />
              </a>
            </p>
          </div>

          <p
            data-hero-line
            className="font-heading mt-14 max-w-xl text-[clamp(1.6rem,3vw,2.6rem)] leading-[1.08] font-semibold tracking-[-0.035em] text-balance"
          >
            The free toolbox for designers and developers
            <span className="text-primary">.</span>
          </p>

          <p
            data-hero-sub
            className="text-muted-foreground mt-4 max-w-md text-base leading-relaxed text-pretty"
          >
            QR codes, favicons, mockups, gradients and more. Free, with no
            account.
          </p>

          <div data-hero-finder className="mt-10">
            <Link
              href="/tools"
              className="bg-primary text-primary-foreground hover:bg-primary/90 group inline-flex h-12 items-center gap-2 rounded-full pr-5 pl-6 text-sm font-semibold transition-colors"
            >
              Browse all tools
              <ArrowRightIcon
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- backdrop */

/**
 * A floor of glossy tiles seen low across its surface, swelling slowly and lit
 * by two lights that drift over it. The cursor presses it down and a click
 * sends a ripple out. It sits on the right, fades before reaching the
 * words, and melts into the page along the bottom edge. Emerald light on dark pages, plain grey tiles on light ones.
 */
function Field({ theme }: { theme: string | undefined }) {
  const dark = theme === "dark";
  return (
    <div
      aria-hidden
      data-hero-bg
      className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_left,black_25%,rgb(0_0_0/0.6)_55%,transparent_85%),linear-gradient(to_top,transparent,black_38%)] [mask-composite:intersect] [-webkit-mask-composite:source-in]"
    >
      {theme && (
        <AcidSquares
          className="pointer-events-auto"
          color={dark ? "#0b0b0b" : "#f4f4f5"}
          accentColor={dark ? "#10b981" : "#a1a1aa"}
          secondaryColor={dark ? "#2dd4bf" : "#d4d4d8"}
          lightMode={!dark}
          lighting="backlit"
          tilt={0.72}
          rotation={35}
          tileSize={1}
          gap={0.14}
          roundness={0.28}
          bulge={0.35}
          gloss={0.7}
          waves={0.8}
          speed={0.45}
          pulse={0.7}
          pulseSpacing={1.4}
          brightness={dark ? 1 : 1.05}
          grain={0.06}
          detail="low"
          dpr={1}
        />
      )}
    </div>
  );
}
