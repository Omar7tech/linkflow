import type { Metadata } from "next";
import Link from "next/link";
import {
  HeartIcon,
  ShieldCheckIcon,
  CodeIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SITE } from "@/constants/site";

export const metadata: Metadata = {
  title: "About",
  description: "Why Forma exists and why every tool is free.",
  alternates: {
    canonical: `${SITE.url}/about`,
  },
};

const VALUES = [
  {
    icon: HeartIcon,
    title: "Built from experience",
    text: "Every tool started as a real problem I faced while freelancing.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Privacy first",
    text: "No accounts. No tracking. No hidden limits. Your data stays yours.",
  },
  {
    icon: CodeIcon,
    title: "Open source",
    text: "Everything is built in the open because software should be transparent.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">

      {/* Hero */}

      <section className="max-w-4xl">

        <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-primary">
          About Forma
        </p>

        <h1 className="text-5xl font-bold tracking-tight leading-[1.05] md:text-7xl">
          Built because I remember what it felt like to need
          <span className="text-primary"> simple tools</span>
          <br />
          and not be able to afford them.
        </h1>

        <p className="mt-8 max-w-2xl text-xl leading-8 text-muted-foreground">
          Forma started as tools I built for myself.
          Today they're free for everyone.
        </p>

      </section>

      {/* About */}

      <section className="mt-28 grid gap-14 lg:grid-cols-[220px_1fr]">

        <aside>

          <div className="sticky top-24">

            <div className="h-20 w-20 rounded-full bg-muted" />

            <h2 className="mt-6 text-2xl font-semibold">
              Omar Abi Farraj
            </h2>

            <p className="mt-2 text-muted-foreground">
              Full-Stack Engineer
              <br />
              Freelancer
              <br />
              Open Source Developer 🇱🇧
            </p>

          </div>

        </aside>

        <div>

          <h2 className="text-4xl font-bold tracking-tight">
            Why is everything free?
          </h2>

          <div className="mt-8 space-y-8 text-lg leading-9 text-muted-foreground">

            <p>
              When I started freelancing, I spent hours looking for small online
              tools. QR generators, WhatsApp links, image converters,
              color pickers... things that should have taken seconds.
            </p>

            <p>
              But almost every website had the same surprise waiting at the end:
              subscriptions, watermarks, account requirements or premium plans
              for features that should have been free.
            </p>

            <p>
              After years of building software professionally, I realized I
              already had the skills to build these tools myself.
            </p>

            <p className="text-foreground font-medium">
              So instead of creating another subscription website,
              I decided to share everything I build.
            </p>

            <p>
              Every tool on Forma exists because I needed it first.
              If it saves me time, there's a good chance it'll help someone else
              too.
            </p>

            <p>
              Today Forma is a growing collection of free tools for developers,
              designers, freelancers, students, businesses and creators around
              the world.
            </p>

          </div>

        </div>

      </section>

      {/* Values */}

      <section className="mt-28">

        <div className="mb-10">
          <h2 className="text-4xl font-bold tracking-tight">
            What Forma stands for
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">

          {VALUES.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border p-8 transition-all hover:border-primary"
            >
              <item.icon className="mb-6 h-6 w-6 text-primary" />

              <h3 className="text-xl font-semibold">
                {item.title}
              </h3>

              <p className="mt-4 leading-8 text-muted-foreground">
                {item.text}
              </p>

            </div>
          ))}

        </div>

      </section>      {/* Closing */}

      <section className="mt-32 border-y py-20">

        <div className="max-w-4xl">

          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            One simple promise
          </p>

          <h2 className="mt-5 text-5xl font-bold tracking-tight leading-tight md:text-6xl">
            If I build something useful,
            <br />
            everyone should be able to use it.
          </h2>

          <p className="mt-8 max-w-2xl text-lg leading-8 text-muted-foreground">
            That's the philosophy behind every tool on Forma.
            No subscriptions. No unnecessary barriers.
            Just useful software, built with care and shared with everyone.
          </p>

        </div>

      </section>

      {/* CTA */}

      <section className="mt-28 text-center">

        <h2 className="text-5xl font-bold tracking-tight md:text-6xl">
          Thanks for being here.
        </h2>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          Whether you're a developer, designer, freelancer,
          student or business owner, I hope Forma makes your work
          just a little easier.
        </p>

        <div className="mt-12 flex justify-center gap-4">

          <Button asChild size="lg">
            <Link href="/tools">
              Explore the tools
            </Link>
          </Button>

          <Button asChild variant="outline" size="lg">
            <Link
              href="https://github.com/Omar7tech"
              target="_blank"
            >
              GitHub
            </Link>
          </Button>

        </div>

      </section>

    </div>
  );
}