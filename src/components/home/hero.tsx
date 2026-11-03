"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowRightIcon, CornerDownLeftIcon, SearchIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { CATALOG } from "@/constants/tools";
import { cn } from "@/lib/utils";
import { TM_GLYPHS, TM_VIEWBOX } from "@/components/shared/logo";
import { TwoMindsLogo } from "@/components/shared/two-minds-logo";
import GradientASCII from "./gradient-ascii";

gsap.registerPlugin(useGSAP);

type Tool = (typeof CATALOG)[number];

const subscribeNever = () => () => undefined;

/** What the search box suggests while it waits. Each one is a real tool. */
const EXAMPLES = [
  "a QR code with my logo",
  "a favicon from an emoji",
  "an iPhone mockup of my app",
  "a gradient for my hero",
  "a share image for my post",
  "a code screenshot",
];

/** Shortcuts under the search box. */
const POPULAR = ["qr", "favicon", "mockup", "codeshot", "bgremover"];

const byId = new Map(CATALOG.map((tool) => [tool.id as string, tool]));

/** Name first, then the short name, then keywords and description: what a person means by a word. */
function findTools(query: string): Tool[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 1 &&
        !["a", "an", "the", "my", "for", "with", "from", "of"].includes(word),
    );
  if (!words.length) return [];
  return CATALOG.map((tool) => {
    const name = `${tool.name} ${tool.shortName}`.toLowerCase();
    const keywords = (tool.keywords as readonly string[])
      .join(" ")
      .toLowerCase();
    const description = tool.description.toLowerCase();
    let score = 0;
    for (const word of words) {
      if (name.startsWith(word)) score += 6;
      else if (name.includes(word)) score += 4;
      else if (keywords.includes(word)) score += 2;
      else if (description.includes(word)) score += 1;
    }
    return { tool, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((entry) => entry.tool);
}

export function Hero() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const hydrated = React.useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const { resolvedTheme } = useTheme();
  const theme = hydrated ? resolvedTheme : undefined;

  useGSAP(
    () => {
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({ defaults: { ease: "power4.out" } })
          .from(
            "[data-hero-char]",
            { yPercent: 115, duration: 1.15, stagger: 0.05 },
            0.15,
          )
          .from(
            "[data-hero-byline]",
            { y: 8, autoAlpha: 0, duration: 0.7 },
            0.55,
          )
          .from(
            "[data-hero-line]",
            { y: 18, autoAlpha: 0, filter: "blur(8px)", duration: 1 },
            0.6,
          )
          .from("[data-hero-sub]", { y: 12, autoAlpha: 0, duration: 0.9 }, 0.75)
          .from(
            "[data-hero-finder]",
            { y: 16, autoAlpha: 0, duration: 0.9 },
            0.9,
          );
      });
    },
    { scope: sectionRef },
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[calc(100svh-3.5rem)] flex-col overflow-hidden"
    >
      <Field theme={theme} />

      {/* Words on the left; the light comes in from the right. */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-6 py-16">
        <div className="max-w-2xl">
          <div className="w-[min(100%,40rem)]">
            <h1 id="hero-title" aria-label="TM TOOLS">
              <svg
                viewBox={TM_VIEWBOX}
                aria-hidden
                className="text-foreground tm-gears-spin block h-auto w-full overflow-hidden fill-current"
              >
                {TM_GLYPHS.map((glyph) => (
                  <g key={glyph.key} data-hero-char>
                    {glyph}
                  </g>
                ))}
              </svg>
            </h1>
            <p
              data-hero-byline
              className="text-muted-foreground mt-3 flex items-center justify-end gap-2.5 text-[11px] leading-none font-semibold tracking-[0.18em] sm:gap-3 sm:text-xs"
            >
              BY
              <a
                href="https://twomindsengine.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Two Minds Engine (opens in a new tab)"
                className="hover:text-foreground focus-visible:ring-ring rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <TwoMindsLogo className="block h-4 sm:h-5" />
              </a>
            </p>
          </div>

          <p
            data-hero-line
            className="font-heading mt-12 max-w-2xl text-[clamp(1.75rem,3.4vw,3rem)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance"
          >
            The free toolbox for designers and developers
            <span className="text-primary">.</span>
          </p>

          <p
            data-hero-sub
            className="text-muted-foreground mt-5 max-w-lg text-base leading-relaxed text-pretty sm:text-lg"
          >
            QR codes, favicons, device mockups, gradients and share images, made
            in seconds. No account, no watermark, nothing to install.
          </p>

          <div data-hero-finder className="mt-9 w-full max-w-xl">
            <ToolFinder />
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- backdrop */

/**
 * Light coming in from the right edge, drawn in characters a developer would type.
 * The cursor scrambles them and a click sends a ring through. Tuned to stay
 * cheap: no glow pass, one pixel per pixel, and it stops drawing off screen.
 * Emerald on dark pages, graphite ink on light ones.
 */
function Field({ theme }: { theme: string | undefined }) {
  const [mono, setMono] = React.useState<string>();
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const family = getComputedStyle(document.documentElement)
        .getPropertyValue("--font-geist-mono")
        .trim();
      setMono(
        family
          ? `${family}, ui-monospace, monospace`
          : "ui-monospace, monospace",
      );
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const dark = theme === "dark";
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_left,black_10%,rgb(0_0_0/0.55)_45%,transparent_80%)]"
    >
      {theme && mono && (
        <GradientASCII
          shape="horizon"
          scale={2.1}
          colors={
            dark
              ? ["#064e3b", "#10b981", "#34d399", "#a7f3d0"]
              : ["#f4f4f5", "#d4d4d8", "#71717a", "#27272a"]
          }
          lightMode={!dark}
          characters=" .:-=+*<>{}/#%"
          cellSize={18}
          density={0.7}
          glyphOpacity={dark ? 0.95 : 0.7}
          gradientOpacity={dark ? 0.5 : 0.3}
          glow={0}
          flicker={0.15}
          softness={0.7}
          flow={0.5}
          speed={0.5}
          grain={0}
          scrambleRadius={0.08}
          dpr={1}
          fontFamily={mono}
        />
      )}
      {/* A clean floor for the next section. */}
      <div className="from-background absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t to-transparent" />
    </div>
  );
}

/* ----------------------------------------------------------------- finder */

/** The front door: say what you are making, get the tool. */
function ToolFinder() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [focused, setFocused] = React.useState(false);
  const [hint, setHint] = React.useState(EXAMPLES[0]);
  const results = React.useMemo(() => findTools(query), [query]);
  const open = focused && query.trim().length > 1;
  const listId = React.useId();

  // The placeholder types out real examples while the box is idle.
  React.useEffect(() => {
    if (focused || query) return;
    let example = 0;
    let shown = EXAMPLES[0].length;
    let deleting = true;
    const timer = window.setInterval(() => {
      const target = EXAMPLES[example];
      if (deleting) {
        shown -= 2;
        if (shown <= 0) {
          deleting = false;
          example = (example + 1) % EXAMPLES.length;
          shown = 0;
        }
      } else {
        shown += 1;
        if (shown >= EXAMPLES[example].length + 18) deleting = true;
      }
      setHint(
        (deleting ? target : EXAMPLES[example]).slice(0, Math.max(0, shown)),
      );
    }, 55);
    return () => window.clearInterval(timer);
  }, [focused, query]);

  const go = (tool: Tool | undefined) => {
    if (tool) router.push(tool.slug);
    else router.push("/tools");
  };

  return (
    <div className="relative">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          go(results[active] ?? results[0]);
        }}
        className={cn(
          "bg-background/80 border-border group flex h-16 items-center gap-3 rounded-2xl border pr-2 pl-5 shadow-[0_1px_0_0_rgb(255_255_255/0.04)_inset,0_24px_60px_-28px_rgb(0_0_0/0.6)] backdrop-blur-xl transition-[border-color,box-shadow]",
          "focus-within:border-primary/60 focus-within:shadow-[0_0_0_4px_var(--glow),0_24px_60px_-28px_rgb(0_0_0/0.6)]",
          open && results.length > 0 && "rounded-b-none",
        )}
      >
        <SearchIcon
          className="text-muted-foreground size-5 shrink-0"
          aria-hidden
        />
        <label htmlFor="hero-finder" className="sr-only">
          What are you making?
        </label>
        <input
          id="hero-finder"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && results[active]
              ? `${listId}-${results[active].id}`
              : undefined
          }
          autoComplete="off"
          spellCheck={false}
          value={query}
          placeholder={focused ? "What are you making?" : `I need ${hint}`}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) =>
                Math.min(index + 1, Math.max(results.length - 1, 0)),
              );
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === "Escape") setQuery("");
          }}
          className="placeholder:text-muted-foreground/70 h-full min-w-0 flex-1 bg-transparent text-base outline-none sm:text-lg"
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-12 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors sm:px-5"
        >
          <span className="hidden sm:inline">
            {query.trim() ? "Open" : "Browse tools"}
          </span>
          {query.trim() ? (
            <CornerDownLeftIcon className="size-4" aria-hidden />
          ) : (
            <ArrowRightIcon className="size-4" aria-hidden />
          )}
        </button>
      </form>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="bg-background/95 border-border absolute inset-x-0 top-full z-20 overflow-hidden rounded-b-2xl border border-t-0 p-1.5 shadow-2xl backdrop-blur-xl"
        >
          {results.length ? (
            results.map((tool, index) => (
              <li
                key={tool.id}
                id={`${listId}-${tool.id}`}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  go(tool);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5",
                  index === active && "bg-muted",
                )}
              >
                <span className="border-border bg-card grid size-9 shrink-0 place-items-center rounded-lg border">
                  <tool.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {tool.name}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {tool.description}
                  </span>
                </span>
                {index === active && (
                  <CornerDownLeftIcon
                    className="text-muted-foreground size-3.5 shrink-0"
                    aria-hidden
                  />
                )}
              </li>
            ))
          ) : (
            <li className="text-muted-foreground px-3 py-4 text-sm">
              Nothing by that name yet.{" "}
              <Link
                href="/tools"
                className="text-foreground underline underline-offset-4"
              >
                See every tool
              </Link>
            </li>
          )}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
        {POPULAR.map((id) => byId.get(id))
          .filter((tool): tool is Tool => !!tool)
          .map((tool) => (
            <Link
              key={tool.id}
              href={tool.slug}
              className="border-border bg-background/60 hover:border-primary/50 hover:text-foreground text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs backdrop-blur transition-colors"
            >
              <tool.icon className="size-3.5" aria-hidden />
              {tool.shortName}
            </Link>
          ))}
      </div>
    </div>
  );
}
