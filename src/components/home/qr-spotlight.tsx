import Link from "next/link";
import {
  ArrowRightIcon,
  ImageIcon,
  LinkIcon,
  PaletteIcon,
  QrCodeIcon,
  ScanLineIcon,
  TypeIcon,
  WifiIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QrPreview } from "@/components/shared/qr-preview";
import { Reveal } from "@/components/home/reveal";
import { SITE } from "@/constants/site";
import type { QrOptions } from "@/types";

/** Clean, standard black code — square modules and eyes, no gradient. */
const SPOTLIGHT_QR: QrOptions = {
  fgColor: "#0a0a0a",
  bgColor: "#ffffff",
  size: 512,
  errorLevel: "M",
  moduleStyle: "square",
  eyeStyle: "square",
  gradient: null,
  transparent: false,
  margin: 2,
  logoScale: 0.22,
};

const CAPABILITIES = [
  { icon: LinkIcon, label: "Links & URLs", note: "Any web address" },
  { icon: WifiIcon, label: "WiFi networks", note: "Join with a scan" },
  { icon: TypeIcon, label: "Plain text", note: "Notes & codes" },
  { icon: PaletteIcon, label: "Custom styling", note: "Colors & shapes" },
  { icon: ImageIcon, label: "Logo overlay", note: "Drop in your mark" },
  { icon: ScanLineIcon, label: "Static forever", note: "No expiry, no redirect" },
];

/** Featured full-width section that frames the QR generator as the flagship tool. */
export function QrSpotlight() {
  return (
    <section aria-labelledby="qr-spotlight-heading" className="border-border/70 border-t">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-16 px-6 py-24 sm:py-28 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
        {/* Copy */}
        <Reveal className="order-2 lg:order-1">
          <p className="text-emerald-700 dark:text-emerald-400 flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.2em] uppercase">
            <span className="bg-emerald-500/40 h-px w-6" aria-hidden />
            <QrCodeIcon className="size-3.5" aria-hidden />
            Featured tool
          </p>
          <h2
            id="qr-spotlight-heading"
            className="font-heading mt-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            QR codes,
            <br />
            crafted to match your brand
            <span className="text-primary">.</span>
          </h2>
          <p className="text-muted-foreground mt-6 max-w-md text-base leading-relaxed">
            Point it at a link, a WiFi network or plain text, then shape the modules, eyes and colors
            — and drop in a logo. It renders live with every keystroke, and every code is static, so
            it keeps working forever.
          </p>

          <ul className="mt-9 grid max-w-lg grid-cols-1 gap-2.5 sm:grid-cols-2">
            {CAPABILITIES.map(({ icon: Icon, label, note }) => (
              <li
                key={label}
                className="group border-border/60 hover:border-emerald-500/40 flex items-center gap-3 rounded-xl border p-3 transition-colors"
              >
                <span className="border-border/70 bg-background flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors group-hover:border-emerald-500/50">
                  <Icon
                    className="size-4 text-emerald-600 dark:text-emerald-400"
                    aria-hidden
                    strokeWidth={1.75}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium tracking-tight">{label}</span>
                  <span className="text-muted-foreground block truncate text-xs">{note}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap items-center gap-5">
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

        {/* Live code — clean framed showcase */}
        <Reveal delay={0.1} className="order-1 flex justify-center lg:order-2 lg:justify-end">
          <div className="border-border bg-card w-full max-w-sm rounded-2xl border p-7 sm:p-8">
            <QrPreview
              value={`${SITE.url}/tools/qr`}
              options={SPOTLIGHT_QR}
              showActions={false}
              className="[&_img]:!max-w-64"
            />
            <p className="text-muted-foreground mt-6 flex items-center justify-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase">
              <ScanLineIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Scan to open
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
