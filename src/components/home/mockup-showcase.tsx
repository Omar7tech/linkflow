import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TOOL_BY_ID } from "@/constants/tools";

/* Real renders from the mockup tool, trimmed to the device. Each is placed by
   its height on a 21:9 stage, so the line-up keeps its spacing at every width. */
const DEVICES = [
  {
    src: "/home/mockup/fold.webp",
    alt: "Foldable phone, open, seen from the back and the inner screen",
    width: 983,
    height: 763,
    className:
      "hidden sm:block left-[4%] bottom-[12%] h-[48%] group-hover:-translate-x-[4%] group-hover:-rotate-2",
  },
  {
    src: "/home/mockup/ipad.webp",
    alt: "Tablet on a keyboard case",
    width: 927,
    height: 885,
    className:
      "left-[42%] sm:left-1/2 bottom-[8%] h-[70%] sm:h-[76%] -translate-x-1/2 z-10 group-hover:-translate-y-[3%]",
  },
  {
    src: "/home/mockup/iphone-back.webp",
    alt: "Phone seen from the back",
    width: 495,
    height: 873,
    className:
      "hidden sm:block right-[4%] bottom-[11%] h-[56%] group-hover:translate-x-[8%] group-hover:rotate-2",
  },
  {
    src: "/home/mockup/iphone.webp",
    alt: "Phone seen from the front",
    width: 478,
    height: 900,
    className:
      "right-[6%] sm:right-[17%] bottom-[9%] h-[62%] sm:h-[58%] z-20 group-hover:-translate-y-[3%]",
  },
] as const;

const SPECS = [
  { label: "Devices", text: "iPhone, a foldable, iPad and MacBook." },
  { label: "Angle", text: "Orbit all the way round, back included." },
  { label: "Light", text: "Studio softboxes and a real floor shadow." },
  { label: "Export", text: "PNG up to 4×, or a WebM reveal clip." },
];

export function MockupShowcase() {
  const tool = TOOL_BY_ID.mockup;

  return (
    <section aria-labelledby="mockup-heading" className="border-border/70 border-t">
      <div className="mx-auto w-full max-w-7xl px-6 py-16 sm:py-24">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="text-muted-foreground/70 text-xs font-medium tracking-wide">
              {tool.name}
            </p>
            <h2
              id="mockup-heading"
              className="font-heading mt-2 text-4xl font-bold tracking-tight text-balance sm:text-5xl"
            >
              Your screen, on a real device<span className="text-primary">.</span>
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className="text-muted-foreground max-w-md leading-relaxed">
              Drop in a screenshot or a video, turn the device to the angle you want and export a
              studio shot. These were made with it.
            </p>
            <Button asChild className="mt-5 h-10 rounded-full px-5">
              <Link href={tool.slug}>
                Open 3D Mockup
                <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>

        {/* The stage: one line-up that spreads a little when the pointer is on it. */}
        <Link
          href={tool.slug}
          aria-label={`Open ${tool.name}`}
          className="group border-border/60 relative mt-10 block aspect-[4/3] sm:aspect-[21/9] overflow-hidden rounded-[2rem] border bg-[radial-gradient(ellipse_70%_80%_at_50%_0%,#ffffff,transparent),linear-gradient(#f4f4f5,#e9e9ec)] dark:bg-[radial-gradient(ellipse_70%_80%_at_50%_0%,#1f1f22,transparent),linear-gradient(#111113,#09090b)]"
        >
          {/* Floor. */}
          <span className="absolute inset-x-[8%] bottom-[3%] h-[10%] rounded-[50%] bg-black/15 blur-2xl dark:bg-white/[0.05]" />

          {DEVICES.map((device) => (
            <Image
              key={device.src}
              src={device.src}
              alt={device.alt}
              width={device.width}
              height={device.height}
              sizes="(min-width: 1280px) 560px, 45vw"
              className={`absolute w-auto drop-shadow-[0_24px_30px_rgb(0_0_0/0.18)] transition-transform duration-700 ease-out ${device.className}`}
            />
          ))}
        </Link>

        <dl className="border-border/60 mt-8 grid grid-cols-2 gap-x-8 gap-y-6 border-t pt-8 lg:grid-cols-4">
          {SPECS.map((spec) => (
            <div key={spec.label}>
              <dt className="text-sm font-semibold">{spec.label}</dt>
              <dd className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
                {spec.text}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
