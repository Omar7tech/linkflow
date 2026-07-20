import Link from "next/link";
import { ArrowRightIcon, QrCodeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QrPreview } from "@/components/shared/qr-preview";
import { Reveal } from "@/components/home/reveal";
import { SITE } from "@/constants/site";
import type { QrOptions } from "@/types";

/** On-brand emerald look for the showcased code. */
const SPOTLIGHT_QR: QrOptions = {
  fgColor: "#059669",
  bgColor: "#ffffff",
  size: 512,
  errorLevel: "M",
  moduleStyle: "dots",
  eyeStyle: "circle",
  eyeColor: "#065f46",
  gradient: { type: "linear", from: "#10b981", to: "#047857", angle: 45 },
  transparent: false,
  margin: 2,
  logoScale: 0.22,
};

const CAPABILITIES = [
  "URLs & plain text",
  "WiFi networks",
  "vCard contacts",
  "Phone & email",
  "Logo overlay",
  "Gradients & shapes",
];

/** Featured full-width section that frames the QR generator as the flagship tool. */
export function QrSpotlight() {
  return (
    <section
      aria-labelledby="qr-spotlight-heading"
      className="border-border/70 relative overflow-hidden border-t"
    >
      {/* Emerald wash + soft glow, weighted to the right where the code sits */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_80%_at_75%_35%,rgba(16,185,129,0.12),transparent_70%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-[size:22px_22px] mask-[radial-gradient(ellipse_60%_65%_at_70%_40%,black,transparent)]"
      />

      <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-6 py-24 sm:py-28 lg:grid-cols-2 lg:gap-20">
        {/* Copy */}
        <Reveal className="order-2 lg:order-1">
          <p className="text-muted-foreground flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase">
            <QrCodeIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            Featured tool
          </p>
          <h2
            id="qr-spotlight-heading"
            className="font-heading mt-4 text-4xl font-bold tracking-tight sm:text-5xl"
          >
            The QR code generator
            <span className="text-primary">.</span>
          </h2>
          <p className="text-muted-foreground mt-5 max-w-md text-base leading-relaxed">
            Point it at a link, a WiFi network or a contact card, then style the modules, eyes and
            colors to match your brand — and drop in a logo. It renders live with every keystroke,
            and every code is static, so it works forever.
          </p>

          <ul className="mt-8 grid max-w-md grid-cols-2 gap-x-6 gap-y-3">
            {CAPABILITIES.map((cap) => (
              <li key={cap} className="flex items-center gap-2.5 text-sm">
                <span className="bg-primary size-1.5 shrink-0 rounded-full" aria-hidden />
                <span className="text-foreground/90">{cap}</span>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap items-center gap-5">
            <Button asChild size="lg" className="h-12 rounded-full px-8 text-base font-semibold">
              <Link href="/tools/qr">
                Open the QR generator
                <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            </Button>
            <Link
              href="/tools#cat-links"
              className="text-foreground text-sm font-medium underline-offset-4 hover:underline"
            >
              Browse link tools
            </Link>
          </div>
        </Reveal>

        {/* Live code */}
        <Reveal delay={0.1} className="order-1 flex justify-center lg:order-2 lg:justify-end">
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-8 -z-10 rounded-[2rem] bg-emerald-500/10 blur-2xl"
            />
            <div className="border-border/70 bg-card/80 rounded-3xl border p-6 shadow-xl backdrop-blur-sm sm:p-8">
              <QrPreview
                value={`${SITE.url}/tools/qr`}
                options={SPOTLIGHT_QR}
                showActions={false}
                className="[&_img]:!max-w-72"
              />
              <p className="text-muted-foreground mt-4 text-center font-mono text-[11px] tracking-[0.18em] uppercase">
                Scan me
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
