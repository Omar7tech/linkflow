import type { Metadata } from "next";
import Link from "next/link";
import { CodeIcon, HeartIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE } from "@/constants/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Forma is a free, privacy-first link and QR toolkit. Learn how it keeps your data private and why it costs nothing to use.",
  alternates: { canonical: `${SITE.url}/about` },
};

const VALUES = [
  {
    icon: ShieldCheckIcon,
    title: "Privacy isn't a feature — it's the architecture",
    text: "The phone numbers, messages and contact details you type are used for one thing only: generating your output. Nothing is logged, analyzed or sold, and there is no analytics pipeline watching what you generate.",
  },
  {
    icon: CodeIcon,
    title: "Built for the everyday link",
    text: "A restaurant adding a WiFi QR to the menu. A freelancer putting a WhatsApp button in an email signature. A marketer tagging campaign URLs before a launch. These tasks shouldn't require an account, a subscription or a 30-page privacy policy.",
  },
  {
    icon: HeartIcon,
    title: "Free, with no catch",
    text: "Forma is lean to operate — so it costs you nothing to use. No freemium walls, no watermarks, no 'your QR code expires in 14 days' emails.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <header className="mb-10">
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">About Forma</h1>
        <p className="text-muted-foreground mt-3 text-lg">
          {SITE.tagline} A small, fast toolkit that turns the links you need every day into
          something you can copy, scan and share in seconds.
        </p>
      </header>

      <div className="space-y-8">
        {VALUES.map((value) => (
          <section key={value.title} className="flex gap-4">
            <span className="border-border bg-muted/40 flex size-10 shrink-0 items-center justify-center rounded-lg border">
              <value.icon className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-semibold">{value.title}</h2>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{value.text}</p>
            </div>
          </section>
        ))}
      </div>

      <section className="border-border bg-muted/30 mt-12 rounded-xl border p-6">
        <h2 className="font-semibold">Under the hood</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Forma is built with Next.js, TypeScript and Tailwind CSS, and ships as an installable
          progressive web app. Link generation uses pure, tested functions per protocol — wa.me,
          sms:, tel:, mailto:, vCard 3.0, WiFi QR payloads and UTM parameters — and QR codes are
          static, with no redirect service in the middle.
        </p>
      </section>

      <div className="mt-10 text-center">
        <Button asChild size="lg">
          <Link href="/tools">Try the tools</Link>
        </Button>
      </div>
    </div>
  );
}
