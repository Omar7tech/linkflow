import Link from "next/link";
import {
  ArrowRightIcon,
  ContactIcon,
  DownloadIcon,
  ImageIcon,
  LinkIcon,
  PaletteIcon,
  QrCodeIcon,
  WifiIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/home/reveal";
import { QrShowcase } from "@/components/home/qr-showcase";

const CAPABILITIES = [
  { icon: LinkIcon, label: "Links & URLs" },
  { icon: WifiIcon, label: "WiFi networks" },
  { icon: ContactIcon, label: "vCard contacts" },
  { icon: PaletteIcon, label: "Custom eyes & colors" },
  { icon: ImageIcon, label: "Logo overlay" },
  { icon: DownloadIcon, label: "SVG & PNG export" },
];

/** Featured full-width section that frames the QR generator as the flagship tool. */
export function QrSpotlight() {
  return (
    <section aria-labelledby="qr-spotlight-heading" className="border-border/70 border-t">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-6 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        {/* Copy */}
        <Reveal className="order-2 lg:order-1">
          <p className="text-emerald-700 dark:text-emerald-400 flex items-center gap-2 font-mono text-xs font-medium tracking-[0.2em] uppercase">
            <QrCodeIcon className="size-3.5" aria-hidden />
            QR Code Generator
          </p>
          <h2
            id="qr-spotlight-heading"
            className="font-heading mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl"
          >
            QR codes, crafted to match your brand
            <span className="text-primary">.</span>
          </h2>
          <p className="text-muted-foreground mt-4 max-w-md text-sm leading-relaxed">
            Style every module, finder eye and color, drop your logo in the middle, then export
            razor-sharp SVG or PNG. Each code is static — no redirects, no expiry, scanning forever.
          </p>

          <ul className="mt-7 flex max-w-lg flex-wrap gap-2">
            {CAPABILITIES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="border-border/60 bg-card/50 flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium"
              >
                <Icon
                  className="size-3.5 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                  strokeWidth={1.75}
                />
                {label}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Button asChild size="lg" className="group h-12 rounded-full px-8 text-base font-semibold">
              <Link href="/tools/qr">
                Open the QR generator
                <ArrowRightIcon
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
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

        {/* Flagship 3D QR visual */}
        <Reveal delay={0.1} className="order-1 flex justify-center lg:order-2 lg:justify-end">
          <QrShowcase />
        </Reveal>
      </div>
    </section>
  );
}
