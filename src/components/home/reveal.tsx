"use client";

import * as React from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Animate direct children with a stagger instead of the wrapper as one block. */
  stagger?: boolean;
  delay?: number;
}

/** Scroll-triggered rise-in. Content stays visible without JS / with reduced motion. */
export function Reveal({ children, className, stagger = false, delay = 0 }: RevealProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const el = ref.current;
        if (!el) return;
        gsap.from(stagger ? Array.from(el.children) : el, {
          y: 28,
          autoAlpha: 0,
          duration: 0.8,
          delay,
          ease: "power3.out",
          stagger: stagger ? 0.07 : 0,
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            once: true,
          },
        });
      });
    },
    { scope: ref }
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
