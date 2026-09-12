import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BellIcon,
  BookmarkIcon,
  CalendarIcon,
  CameraIcon,
  CheckIcon,
  CloudIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  GlobeIcon,
  HeartIcon,
  HouseIcon,
  ImageIcon,
  LinkIcon,
  LockIcon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
  MoonIcon,
  PhoneIcon,
  PlayIcon,
  SearchIcon,
  SettingsIcon,
  ShoppingCartIcon,
  StarIcon,
  SunIcon,
  Trash2Icon,
  UserIcon,
  WifiIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/home/reveal";
import styles from "./icon-marquee.module.css";

/**
 * `query` is what the tile searches for, so each icon is a shortcut into the
 * library rather than decoration. The words are deliberately plain, because
 * they are handed to Iconify's search as typed.
 */
type Glyph = { icon: LucideIcon; query: string };

const ROW_ONE: readonly Glyph[] = [
  { icon: SearchIcon, query: "search" },
  { icon: HouseIcon, query: "home" },
  { icon: UserIcon, query: "user" },
  { icon: SettingsIcon, query: "settings" },
  { icon: HeartIcon, query: "heart" },
  { icon: StarIcon, query: "star" },
  { icon: BellIcon, query: "bell" },
  { icon: MailIcon, query: "mail" },
  { icon: CalendarIcon, query: "calendar" },
  { icon: CameraIcon, query: "camera" },
  { icon: DownloadIcon, query: "download" },
  { icon: LockIcon, query: "lock" },
  { icon: CheckIcon, query: "check" },
  { icon: FolderIcon, query: "folder" },
  { icon: GlobeIcon, query: "globe" },
];

const ROW_TWO: readonly Glyph[] = [
  { icon: PlayIcon, query: "play" },
  { icon: CloudIcon, query: "cloud" },
  { icon: FileIcon, query: "file" },
  { icon: ImageIcon, query: "image" },
  { icon: LinkIcon, query: "link" },
  { icon: MapPinIcon, query: "map pin" },
  { icon: PhoneIcon, query: "phone" },
  { icon: ShoppingCartIcon, query: "cart" },
  { icon: SunIcon, query: "sun" },
  { icon: MoonIcon, query: "moon" },
  { icon: WifiIcon, query: "wifi" },
  { icon: ZapIcon, query: "bolt" },
  { icon: Trash2Icon, query: "trash" },
  { icon: BookmarkIcon, query: "bookmark" },
  { icon: MessageCircleIcon, query: "chat" },
];


/**
 * Official marks, served by svgl (the same source the icon library itself
 * uses), so nothing here is a redrawn or approximated logo. Brands whose mark
 * is monochrome ship a second route for the opposite theme; the rest are
 * legible on both grounds as they are.
 */
type Brand = { title: string; query: string; light: string; dark?: string };

const LIB = "https://svgl.app/library";

const BRANDS: readonly Brand[] = [
  { title: "Figma", query: "figma", light: `${LIB}/figma.svg` },
  { title: "GitHub", query: "github", light: `${LIB}/github_light.svg`, dark: `${LIB}/github_dark.svg` },
  { title: "React", query: "react", light: `${LIB}/react_light.svg`, dark: `${LIB}/react_dark.svg` },
  { title: "Vercel", query: "vercel", light: `${LIB}/vercel.svg`, dark: `${LIB}/vercel_dark.svg` },
  { title: "Tailwind CSS", query: "tailwind", light: `${LIB}/tailwindcss.svg` },
  { title: "TypeScript", query: "typescript", light: `${LIB}/typescript.svg` },
  { title: "Node.js", query: "node", light: `${LIB}/nodejs.svg` },
  { title: "Vite", query: "vite", light: `${LIB}/vite.svg` },
  { title: "Supabase", query: "supabase", light: `${LIB}/supabase.svg` },
  { title: "Stripe", query: "stripe", light: `${LIB}/stripe.svg` },
  { title: "Slack", query: "slack", light: `${LIB}/slack.svg` },
  { title: "Discord", query: "discord", light: `${LIB}/discord.svg` },
  { title: "Cloudflare", query: "cloudflare", light: `${LIB}/cloudflare.svg` },
  { title: "Framer", query: "framer", light: `${LIB}/framer.svg`, dark: `${LIB}/framer_dark.svg` },
];

/**
 * Plain <img> on purpose: next/image refuses remote SVG unless the optimiser is
 * opened up to it, and these are already the smallest possible payload. Fixed
 * dimensions keep the row from shifting while they arrive.
 */
function Mark({ src, alt, hiddenInDark }: { src: string; alt: string; hiddenInDark?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote SVG, see above
    <img
      src={src}
      alt={alt}
      width={26}
      height={26}
      loading="lazy"
      decoding="async"
      className={`${styles.brandMark} size-6.5 object-contain ${
        hiddenInDark === true ? "dark:hidden" : hiddenInDark === false ? "hidden dark:block" : ""
      }`}
    />
  );
}

function BrandTile({ brand, decorative }: { brand: Brand; decorative: boolean }) {
  return (
    <Link
      href={`/icons?q=${encodeURIComponent(brand.query)}`}
      aria-label={decorative ? undefined : `Find the ${brand.title} logo`}
      title={brand.title}
      aria-hidden={decorative || undefined}
      tabIndex={decorative ? -1 : undefined}
      className={`${styles.brandTile} border-border/60 bg-card hover:border-primary/40 grid h-13 w-20 shrink-0 place-items-center rounded-xl border transition-colors duration-200`}
    >
      {brand.dark ? (
        <>
          <Mark src={brand.light} alt={brand.title} hiddenInDark />
          <Mark src={brand.dark} alt="" hiddenInDark={false} />
        </>
      ) : (
        <Mark src={brand.light} alt={brand.title} />
      )}
    </Link>
  );
}

function BrandRow() {
  return (
    <div className={styles.viewport}>
      <div className={styles.track} style={{ "--marquee-duration": "68s" } as CSSProperties}>
        {[false, true].map((decorative) => (
          <div
            key={String(decorative)}
            className={styles.brandGroup}
            aria-hidden={decorative || undefined}
          >
            {BRANDS.map((brand) => (
              <BrandTile key={brand.title} brand={brand} decorative={decorative} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Tile({ glyph, decorative }: { glyph: Glyph; decorative: boolean }) {
  const { icon: Icon, query } = glyph;
  return (
    <Link
      href={`/icons?q=${encodeURIComponent(query)}`}
      aria-label={decorative ? undefined : `Search ${query} icons`}
      title={query}
      // The second copy exists only to close the loop, so it stays out of the
      // tab order and out of the accessibility tree.
      aria-hidden={decorative || undefined}
      tabIndex={decorative ? -1 : undefined}
      className="border-border/60 bg-card text-muted-foreground hover:border-primary/40 hover:text-primary grid size-13 shrink-0 place-items-center rounded-xl border transition-colors duration-200"
    >
      <Icon className="size-5" aria-hidden strokeWidth={1.75} />
    </Link>
  );
}

function Row({ glyphs, reverse }: { glyphs: readonly Glyph[]; reverse?: boolean }) {
  return (
    <div className={styles.viewport}>
      <div className={`${styles.track} ${reverse ? styles.reverse : ""}`}>
        {[false, true].map((decorative) => (
          <div key={String(decorative)} className={styles.group} aria-hidden={decorative || undefined}>
            {glyphs.map((glyph) => (
              <Tile key={glyph.query} glyph={glyph} decorative={decorative} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Icon library teaser. Two rows drifting in opposite directions, where every
 * tile is a live shortcut into the library's search rather than a picture of
 * one. Pauses on hover so a tile can actually be aimed at.
 */
export function IconMarquee() {
  return (
    <section className="border-border/70 border-t" aria-labelledby="icons-heading">
      <div className="mx-auto max-w-7xl px-6 py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-14">
          {/* Copy sits beside the library rather than above it: shorter section,
              and the motion gets a frame instead of running loose full width. */}
          <Reveal className="lg:col-span-4">
            <p className="text-muted-foreground flex items-center gap-2 font-mono text-[11px] tracking-[0.22em] uppercase">
              <span className="bg-primary inline-block size-1.5 rounded-full" aria-hidden />
              SVG Library
            </p>
            <h2
              id="icons-heading"
              className="font-heading mt-3 text-3xl font-bold tracking-tight sm:text-4xl"
            >
              Every icon,
              <br className="hidden lg:block" /> one search<span className="text-primary">.</span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-md text-sm leading-relaxed">
              Open-source icon sets and brand logos in one place. Recolor it, copy the SVG, done.
            </p>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="group/cta mt-6 h-11 rounded-full px-7 font-semibold"
            >
              <Link href="/icons">
                Open the library
                <ArrowRightIcon
                  className="size-4 transition-transform group-hover/cta:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </Button>
          </Reveal>

          <Reveal delay={0.1} className="lg:col-span-8">
            <div className="border-border/60 bg-muted/30 relative overflow-hidden rounded-2xl border p-4 sm:p-5">
              {/* Faint plate behind the tiles, same dot grid the hero uses */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-[size:16px_16px] opacity-70"
              />

              <div className="relative space-y-2.5">
                <Row glyphs={ROW_ONE} />
                <Row glyphs={ROW_TWO} reverse />
              </div>

              {/* Labelled rule: says what the second half is without a heading */}
              <div className="relative mt-5 flex items-center gap-4">
                <span className="bg-border h-px flex-1" aria-hidden />
                <span className="text-muted-foreground/70 font-mono text-[10px] tracking-[0.22em] uppercase">
                  Brand logos
                </span>
                <span className="bg-border h-px flex-1" aria-hidden />
              </div>

              <div className="relative mt-5">
                <BrandRow />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
