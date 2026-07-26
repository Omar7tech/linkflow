import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/home/reveal";
import { SITE } from "@/constants/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why Forma exists, who builds it, and why every tool is free — no accounts, no tracking, no paywalls.",
  alternates: { canonical: `${SITE.url}/about` },
};

const PRINCIPLES = [
  {
    title: "Built from experience",
    text: "Every tool started as a real problem I hit while freelancing — the small jobs that should take seconds, not a subscription.",
  },
  {
    title: "Private by default",
    text: "No accounts, no tracking pixels, no hidden limits. Your input is used to make your result and nothing else. Your data stays yours.",
  },
  {
    title: "Open and free",
    text: "Free with no watermarks or paywalls, built in the open. If it saves me time, it should be able to help you too.",
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs font-medium tracking-[0.2em] text-emerald-700 uppercase dark:text-emerald-400">
      {children}
    </p>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6">
      {/* Hero */}
      <section className="py-20 sm:py-28">
        <Reveal>
          <Eyebrow>About Forma</Eyebrow>
          <h1 className="font-heading mt-5 max-w-4xl text-5xl leading-[1.05] font-bold tracking-tight text-balance md:text-7xl">
            Built because I remember needing
            <span className="text-primary"> simple tools</span> and not being able to afford them.
          </h1>
          <p className="text-muted-foreground mt-8 max-w-xl text-lg leading-relaxed">
            Forma started as tools I built for myself. Today they&apos;re free for everyone — no
            accounts, no catch.
          </p>
        </Reveal>
      </section>

      {/* Story */}
      <section className="border-border/70 grid gap-12 border-t py-16 sm:py-20 lg:grid-cols-[260px_1fr] lg:gap-16">
        <Reveal className="lg:sticky lg:top-24 lg:self-start">
          <div className="border-border/60 bg-muted relative size-32 overflow-hidden rounded-2xl border">
            <Image
              src="/omarimage.jpeg"
              alt="Omar Abi Farraj"
              fill
              sizes="128px"
              className="object-cover grayscale transition-all duration-500 hover:grayscale-0"
              priority
            />
          </div>
          <h2 className="font-heading mt-6 text-2xl font-semibold tracking-tight">
            Omar Abi Farraj
          </h2>
          <dl className="text-muted-foreground mt-3 space-y-1 text-sm leading-relaxed">
            <dd>Full-Stack Engineer</dd>
            <dd>Freelance &amp; open source</dd>
            <dd>Lebanon 🇱🇧</dd>
          </dl>
          <Link
            href="https://github.com/Omar7tech"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground group mt-5 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
          >
            GitHub
            <ArrowUpRightIcon
              className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden
            />
          </Link>
        </Reveal>

        <Reveal>
          <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Why everything is free
            <span className="text-primary">.</span>
          </h2>
          <div className="text-muted-foreground mt-7 space-y-5 text-base leading-relaxed sm:text-lg">
            <p>
              When I started freelancing, I spent hours hunting for small online tools — QR
              generators, WhatsApp links, image converters, color pickers. Things that should have
              taken seconds.
            </p>
            <p>
              But almost every site had the same surprise at the end: subscriptions, watermarks,
              account walls or premium plans for features that should have been free.
            </p>
            <p className="text-foreground font-medium">
              After years building software professionally, I realized I could just build these
              myself — and share them, instead of putting up another paywall.
            </p>
            <p>
              Every tool on Forma exists because I needed it first. Today it&apos;s a growing
              collection of free tools for developers, designers, freelancers, students and creators
              around the world.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Principles — numbered editorial rows */}
      <section className="border-border/70 border-t py-16 sm:py-20" aria-labelledby="principles">
        <Reveal className="mb-10">
          <Eyebrow>What Forma stands for</Eyebrow>
          <h2
            id="principles"
            className="font-heading mt-4 text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Three things that never change
            <span className="text-primary">.</span>
          </h2>
        </Reveal>
        <Reveal stagger className="flex flex-col">
          {PRINCIPLES.map((item, i) => (
            <div
              key={item.title}
              className="border-border group grid items-baseline gap-x-8 gap-y-2 border-t py-8 last:border-b sm:grid-cols-[80px_1fr_1.5fr]"
            >
              <span className="font-heading text-primary/30 group-hover:text-primary text-4xl font-bold tracking-tight transition-colors sm:text-5xl">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="font-heading text-2xl font-semibold tracking-tight">{item.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
                {item.text}
              </p>
            </div>
          ))}
        </Reveal>
      </section>

      {/* Manifesto */}
      <section className="border-border/70 border-t py-20 sm:py-28">
        <Reveal className="max-w-4xl">
          <Eyebrow>One simple promise</Eyebrow>
          <p className="font-heading mt-5 text-4xl leading-[1.1] font-bold tracking-tight text-balance sm:text-6xl">
            If I build something useful, everyone should be able to use it
            <span className="text-primary">.</span>
          </p>
          <p className="text-muted-foreground mt-8 max-w-2xl text-base leading-relaxed sm:text-lg">
            That&apos;s the philosophy behind every tool on Forma. No subscriptions, no unnecessary
            barriers — just useful software, built with care and shared with everyone.
          </p>
        </Reveal>
      </section>

      {/* Closing CTA */}
      <section className="border-border/70 border-t">
        <Reveal className="grid gap-10 py-24 sm:grid-cols-12 sm:items-end sm:py-28">
          <h2 className="font-heading text-4xl font-bold tracking-tight sm:col-span-8 sm:text-6xl">
            Thanks for being here
            <span className="text-primary">.</span>
          </h2>
          <div className="flex flex-col items-start gap-4 sm:col-span-4 sm:items-end">
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="group h-12 rounded-full px-7 font-semibold">
                <Link href="/tools">
                  Explore the tools
                  <ArrowRightIcon
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full px-7 font-semibold"
              >
                <Link href="https://github.com/Omar7tech" target="_blank" rel="noopener noreferrer">
                  GitHub
                </Link>
              </Button>
            </div>
            <p className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
              Free / Private / No sign-up
            </p>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
