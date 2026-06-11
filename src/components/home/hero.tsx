"use client";

import * as React from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowRightIcon, QrCodeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TOOLS } from "@/constants/tools";
import { SITE } from "@/constants/site";
import { qrToPngDataUrl } from "@/lib/qr";

gsap.registerPlugin(useGSAP);

export function Hero() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const [qr, setQr] = React.useState<string | null>(null);

  React.useEffect(() => {
    qrToPngDataUrl(SITE.url, {
      size: 192,
      fgColor: "#10150f",
      bgColor: "#ffffff",
      errorLevel: "M",
    })
      .then(setQr)
      .catch(() => undefined);
  }, []);

  useGSAP(
    (_, contextSafe) => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          reduce: "(prefers-reduced-motion: reduce)",
          ok: "(prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          if (ctx.conditions?.reduce) return;

          // Intro: lines rise out of overflow masks, then UI fades in.
          const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
          tl.from("[data-hero-line]", {
            yPercent: 115,
            duration: 1,
            stagger: 0.12,
          })
            .from(
              "[data-hero-fade]",
              { y: 22, autoAlpha: 0, duration: 0.7, stagger: 0.09 },
              "-=0.55"
            )
            .from(
              "[data-hero-chip]",
              { y: 36, autoAlpha: 0, scale: 0.9, duration: 0.8, stagger: 0.1 },
              "-=0.5"
            );

          // Ambient drift — chips bob, orbs wander.
          gsap.to("[data-hero-chip]", {
            y: "-=12",
            duration: 2.6,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            stagger: { each: 0.4 },
          });
          gsap.to("[data-orb='a']", {
            xPercent: 10,
            yPercent: -8,
            duration: 11,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          });
          gsap.to("[data-orb='b']", {
            xPercent: -12,
            yPercent: 10,
            duration: 13,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          });
        }
      );

      // Pointer parallax on the floating chips (desktop only, motion allowed).
      const chips = gsap.utils.toArray<HTMLElement>("[data-hero-chip]");
      const setters = chips.map((chip) => ({
        x: gsap.quickTo(chip, "x", { duration: 0.8, ease: "power3.out" }),
        depth: Number(chip.dataset.depth ?? 1),
      }));
      if (!contextSafe) return;
      const onPointerMove = contextSafe((e: PointerEvent) => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const relX = e.clientX / window.innerWidth - 0.5;
        for (const setter of setters) setter.x(relX * 28 * setter.depth);
      });
      const node = sectionRef.current;
      node?.addEventListener("pointermove", onPointerMove);
      return () => node?.removeEventListener("pointermove", onPointerMove);
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="noise relative flex min-h-[92svh] flex-col overflow-hidden"
      aria-label="LinkFlow — create, share, connect"
    >
      {/* Backdrop: grid lines + gradient orbs */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.13] [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]"
      />
      <div
        aria-hidden
        data-orb="a"
        className="bg-primary/25 absolute -top-32 left-1/2 size-130 -translate-x-[80%] rounded-full blur-[140px]"
      />
      <div
        aria-hidden
        data-orb="b"
        className="absolute top-10 left-1/2 size-110 translate-x-[15%] rounded-full bg-[oklch(0.75_0.13_180_/_0.18)] blur-[130px]"
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        {/* Floating artifacts */}
        <div
          data-hero-chip
          data-depth="1.6"
          className="border-border/80 bg-card/80 absolute top-[16%] left-[4%] hidden rotate-[-6deg] rounded-2xl border p-3 shadow-xl backdrop-blur-md lg:block"
        >
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- generated data URL
            <img src={qr} alt="" width={96} height={96} className="size-24 rounded-lg" />
          ) : (
            <div className="bg-muted flex size-24 items-center justify-center rounded-lg">
              <QrCodeIcon className="text-muted-foreground size-8" />
            </div>
          )}
          <p className="text-muted-foreground mt-2 text-center font-mono text-[10px]">
            scan → linkflow
          </p>
        </div>
        <div
          data-hero-chip
          data-depth="1"
          className="border-border/80 bg-card/80 absolute top-[24%] right-[5%] hidden rotate-[5deg] items-center gap-2 rounded-full border px-4 py-2.5 shadow-xl backdrop-blur-md lg:flex"
        >
          <span className="size-2 rounded-full bg-green-500" />
          <span className="font-mono text-xs">wa.me/96171234567</span>
        </div>
        <div
          data-hero-chip
          data-depth="1.3"
          className="border-border/80 bg-card/80 absolute bottom-[24%] left-[8%] hidden rotate-[4deg] items-center gap-2 rounded-full border px-4 py-2.5 shadow-xl backdrop-blur-md lg:flex"
        >
          <span className="text-primary font-mono text-xs">?utm_campaign=launch</span>
        </div>
        <div
          data-hero-chip
          data-depth="0.9"
          className="border-border/80 bg-card/80 absolute right-[7%] bottom-[18%] hidden rotate-[-4deg] rounded-2xl border px-4 py-3 text-left shadow-xl backdrop-blur-md lg:block"
        >
          <div className="flex items-center gap-2.5">
            <span className="bg-foreground text-background flex size-8 items-center justify-center rounded-full text-xs font-bold">
              MH
            </span>
            <div>
              <p className="text-xs font-semibold">Maya Haddad</p>
              <p className="text-muted-foreground text-[10px]">Product Designer · vCard</p>
            </div>
          </div>
        </div>

        {/* Copy */}
        <div data-hero-fade className="border-border bg-card/60 text-muted-foreground mb-7 flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium backdrop-blur-md">
          <span className="bg-primary inline-block size-1.5 animate-pulse rounded-full" />
          Free forever · No sign-up · 100% client-side
        </div>

        <h1 className="font-heading text-[clamp(3.2rem,11vw,8rem)] leading-[0.95] font-bold tracking-tight">
          <span className="block overflow-hidden pb-1">
            <span data-hero-line className="block">
              Create.
            </span>
          </span>
          <span className="block overflow-hidden pb-1">
            <span data-hero-line className="block">
              Share.
            </span>
          </span>
          <span className="block overflow-hidden pb-2">
            <span data-hero-line className="text-gradient block">
              Connect.
            </span>
          </span>
        </h1>

        <p
          data-hero-fade
          className="text-muted-foreground mx-auto mt-6 max-w-xl text-base text-balance sm:text-lg"
        >
          WhatsApp links, custom QR codes, digital business cards and campaign URLs — generated
          instantly in your browser. Nothing leaves your device.
        </p>

        <div data-hero-fade className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="glow h-11 rounded-full px-7 text-base">
            <Link href="/universal">
              Start creating <ArrowRightIcon />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 rounded-full px-7 text-base backdrop-blur-md">
            <Link href="/tools">Explore 9 tools</Link>
          </Button>
        </div>
      </div>

      {/* Marquee */}
      <div data-hero-fade className="border-border/60 relative border-t py-4">
        <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
          <div className="animate-marquee motion-reduce:animate-none flex w-max items-center gap-10 whitespace-nowrap">
            {[0, 1].map((copy) => (
              <div key={copy} aria-hidden={copy === 1} className="flex items-center gap-10">
                {TOOLS.map((tool) => (
                  <span key={tool.id} className="text-muted-foreground flex items-center gap-10 text-sm font-medium">
                    {tool.name}
                    <span className="text-primary/60">✦</span>
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
