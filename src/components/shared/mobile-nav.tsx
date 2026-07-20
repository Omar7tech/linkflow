"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

const MOBILE_NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/tools", label: "Tools" },
  { href: "/icons", label: "Icons" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
];

/** Burger button that morphs into a cross when the mobile nav is open. */
export function MobileNavTrigger({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const ref = React.useRef<HTMLButtonElement>(null);

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const duration = reduced ? 0 : 0.35;
      gsap.to(".burger-line-top", { rotate: open ? 45 : 0, y: open ? 4 : 0, duration, ease: "power2.inOut" });
      gsap.to(".burger-line-bottom", {
        rotate: open ? -45 : 0,
        y: open ? -4 : 0,
        duration,
        ease: "power2.inOut",
      });
    },
    { dependencies: [open], scope: ref }
  );

  return (
    <button
      ref={ref}
      type="button"
      onClick={onToggle}
      className="flex size-9 flex-col items-center justify-center gap-[6px] md:hidden"
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
    >
      <span className="burger-line-top bg-foreground block h-[1.5px] w-5 rounded-full" />
      <span className="burger-line-bottom bg-foreground block h-[1.5px] w-5 rounded-full" />
    </button>
  );
}

/** Mobile nav panel — the header bar itself expands downward to reveal the links. */
export function MobileNavPanel({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const panelRef = React.useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.set(panelRef.current, { height: 0 });
      gsap.set(".menu-item", { y: 12, opacity: 0 });
    },
    { scope: panelRef }
  );

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (open) {
        gsap.set(".menu-item", { y: 12, opacity: 0 });
        gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .to(panelRef.current, { height: "auto", duration: reduced ? 0 : 0.45 })
          .to(
            ".menu-item",
            { y: 0, opacity: 1, stagger: reduced ? 0 : 0.05, duration: reduced ? 0 : 0.35 },
            "-=0.2"
          );
      } else {
        gsap
          .timeline({ defaults: { ease: "power2.inOut" } })
          .to(".menu-item", {
            y: 12,
            opacity: 0,
            stagger: { each: 0.03, from: "end" },
            duration: reduced ? 0 : 0.2,
          })
          .to(panelRef.current, { height: 0, duration: reduced ? 0 : 0.3 }, "<0.05");
      }
    },
    { dependencies: [open], scope: panelRef }
  );

  return (
    <div ref={panelRef} className="h-0 overflow-hidden md:hidden">
      <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3" aria-label="Mobile">
        {MOBILE_NAV_LINKS.map((link, i) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className="menu-item group flex items-baseline gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted"
            >
              <span className="text-muted-foreground font-mono text-xs">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "font-heading text-2xl font-bold tracking-tight transition-colors",
                  active ? "text-primary" : "text-foreground group-hover:text-primary"
                )}
              >
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
