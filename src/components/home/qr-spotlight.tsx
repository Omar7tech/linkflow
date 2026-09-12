import Link from "next/link";
import {
  ArrowRightIcon,
  ContactIcon,
  DownloadIcon,
  ImageIcon,
  LinkIcon,
  PaletteIcon,
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
      <div className="mx-auto grid w-full max-w-7xl gap-14 px-6 py-20 sm:py-28 lg:grid-cols-12 lg:items-center lg:gap-x-16">
        {/* Copy */}
        <Reveal className="order-2 lg:order-1 lg:col-span-6">
          <p className="text-muted-foreground flex items-center gap-4 font-mono text-[11px] tracking-[0.22em] uppercase">
            QR Code Generator
            <span className="bg-border h-px flex-1" aria-hidden />
          </p>

          <h2
            id="qr-spotlight-heading"
            className="font-heading mt-6 text-4xl leading-[1.02] font-bold tracking-tight sm:text-5xl lg:text-[3.4rem]"
          >
            Your logo. Your colors.
            <br />
            Still scans<span className="text-primary">.</span>
          </h2>

          <p className="text-muted-foreground mt-6 max-w-lg text-base leading-relaxed">
            Shape the modules, recolor the finder eyes, drop a logo through the middle, then export
            SVG or PNG at whatever size the print shop asks for. Every code is static — the data
            lives in the pattern itself, so nothing expires and nothing redirects.
          </p>

          <ul className="mt-10 grid max-w-lg gap-x-10 sm:grid-cols-2">
            {CAPABILITIES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="border-border/60 flex items-center gap-3 border-t py-3 font-mono text-[11px] tracking-[0.14em] uppercase"
              >
                <Icon
                  className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                  strokeWidth={1.75}
                />
                {label}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Button asChild size="lg" className="group h-12 rounded-full px-8 text-base font-semibold">
              <Link href="/tools/qr">
                Open the generator
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

        {/* Flagship QR visual */}
        <Reveal
          delay={0.1}
          className="order-1 flex justify-center lg:order-2 lg:col-span-5 lg:col-start-8 lg:justify-end"
        >
          <QrShowcase />
        </Reveal>
      </div>
    </section>
  );
}
