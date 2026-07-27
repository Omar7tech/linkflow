import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  GitBranchIcon,
  HeartIcon,
  QuoteIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE } from "@/constants/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why Forma exists, who builds it, and why every tool is free — no accounts, no tracking, no paywalls.",
  alternates: { canonical: `${SITE.url}/about` },
};

const PRINCIPLES = [
  {
    icon: HeartIcon,
    title: "Built from experience",
    text: "Every tool began as a real problem I hit while freelancing.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Private by default",
    text: "No accounts, no tracking, no hidden limits. Your data stays yours.",
  },
  {
    icon: GitBranchIcon,
    title: "Open & free",
    text: "No watermarks, no paywalls — and built in the open.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6">
      {/* Hero */}
      <section className="grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="font-mono text-xs font-medium tracking-[0.2em] text-emerald-700 uppercase dark:text-emerald-400">
            About Forma
          </p>
          <h1 className="font-heading mt-5 text-4xl leading-[1.08] font-bold tracking-tight text-balance sm:text-5xl">
            Built because I remember needing
            <span className="text-primary"> simple tools</span> and not being able to afford them.
          </h1>
          <p className="text-muted-foreground mt-6 max-w-md text-base leading-relaxed">
            Forma started as tools I built for myself. Today they&apos;re free for everyone.
          </p>

          {/* Byline */}
          <div className="border-border/60 mt-8 flex items-center gap-3 border-t pt-6">
            <div className="border-border/60 bg-muted relative size-11 shrink-0 overflow-hidden rounded-full border">
              <Image
                src="/omarimage.jpeg"
                alt="Omar Abi Farraj"
                fill
                sizes="44px"
                className="object-cover"
                priority
              />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-sm font-semibold tracking-tight">Omar Abi Farraj</p>
              <p className="text-muted-foreground text-xs">Full-Stack Engineer · Lebanon 🇱🇧</p>
            </div>
            <Link
              href="https://github.com/Omar7tech"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground group ml-auto inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
            >
              GitHub
              <ArrowUpRightIcon
                className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden
              />
            </Link>
          </div>
        </div>

        {/* Visual */}
        <div className="relative">
          <Image
            src="/about/desk-green.webp"
            alt="An illustrated desk with a laptop and small tools floating out of the screen"
            width={1024}
            height={1024}
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="h-auto w-full drop-shadow-xl"
            priority
          />
        </div>
      </section>

      {/* Story */}
      <section className="border-border/70 grid gap-8 border-t py-14 sm:py-16 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
        <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Why everything is free
          <span className="text-primary">.</span>
        </h2>
        <div className="text-muted-foreground space-y-4 text-base leading-relaxed">
          <p>
            Freelancing, I spent hours hunting for small online tools — QR codes, WhatsApp links,
            image converters, color pickers. Things that should have taken seconds. But almost every
            site hid a paywall at the end: subscriptions, watermarks or account walls.
          </p>
          <p className="text-foreground font-medium">
            So instead of building another subscription site, I decided to share everything I make.
            Every tool on Forma exists because I needed it first.
          </p>
        </div>
      </section>

      {/* Principles */}
      <section className="border-border/70 border-t py-14 sm:py-16">
        <div className="grid gap-4 sm:grid-cols-3">
          {PRINCIPLES.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="group border-border/60 bg-card rounded-2xl border p-6 transition-colors hover:border-emerald-500/40"
            >
              <span className="border-border/70 bg-muted/40 group-hover:border-emerald-500/30 group-hover:bg-emerald-500/10 flex size-10 items-center justify-center rounded-lg border transition-colors">
                <Icon className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              </span>
              <h3 className="font-heading mt-4 text-base font-semibold tracking-tight">{title}</h3>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Manifesto + CTA */}
      <section className="pt-2 pb-20 sm:pb-24">
        <div className="border-emerald-500/20 bg-emerald-500/5 grid items-center gap-8 rounded-3xl border p-8 sm:p-10 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <QuoteIcon
              className="size-6 text-emerald-600/70 dark:text-emerald-400/70"
              aria-hidden
            />
            <p className="font-heading mt-3 text-2xl leading-snug font-bold tracking-tight text-balance sm:text-3xl">
              If I build something useful, everyone should be able to use it.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <Button asChild size="lg" className="group h-12 rounded-full px-7 font-semibold">
              <Link href="/tools">
                Explore the tools
                <ArrowRightIcon
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </Button>
            <p className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
              Free / Private / No sign-up
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
