"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { Emblem } from "@/components/shared/tool-grid";
import { ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";
import OptionWheel from "@/components/reactbits/option-wheel";
import { TOOLS, TOOL_CATEGORIES } from "@/constants/tools";
import { accentFor } from "@/lib/tool-accent";
import styles from "./category-wheel.module.css";

const LABELS = TOOL_CATEGORIES.map((c) => c.label);

/** Same running order the rest of the site uses to surface flagship tools. */
const FEATURED = ["mockup", "logo3d", "codeshot", "invoice", "qr", "bgremover"];

const PICKS_BY_CATEGORY = Object.fromEntries(
  TOOL_CATEGORIES.map((category) => [
    category.id,
    TOOLS.filter((t) => t.category === category.id)
      .slice()
      .sort((a, b) => {
        const ai = FEATURED.indexOf(a.id);
        const bi = FEATURED.indexOf(b.id);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
      .slice(0, 4),
  ])
);

/**
 * Desktop-only category browser: the ten categories ride a wheel that curves
 * around the left edge, and the panel on the right redraws in the selected
 * category's own accent. Scroll, drag, click or arrow-key it.
 *
 * The narrow-screen list in page.tsx carries the same content for touch.
 */
export function CategoryWheel() {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);

  const category = TOOL_CATEGORIES[index];
  const accent = accentFor(category.id);
  const picks = PICKS_BY_CATEGORY[category.id];
  const Icon = category.icon;

  const selectCategory = (i: number) => {
    setIndex(i);
    setHovered(null);
  };

  return (
    <div
      className={`${styles.stage} relative grid grid-cols-[1.15fr_1fr] items-center gap-20`}
      style={
        { "--cat-light": accent.value.light, "--cat-dark": accent.value.dark } as CSSProperties
      }
    >
      {/* Wheel */}
      <div className="h-[32rem] [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]">
        <OptionWheel
          items={LABELS}
          defaultSelected={0}
          onChange={selectCategory}
          textColor="var(--muted-foreground)"
          activeColor="var(--cat-active)"
          side="left"
          fontSize={2.6}
          spacing={1.3}
          curve={1}
          tilt={5}
          blur={1.4}
          fade={0.2}
          minOpacity={0.12}
          smoothing={230}
          // A 5deg tilt puts the arc radius near 620px, so options still on
          // screen swing at most ~56px left of centre. The inset keeps that
          // swing inside the box instead of clipping it against the edge.
          inset={72}
          loop
          draggable
          soundUrl="/sounds/wheel-tick.wav"
          soundVolume={0.35}
        />
      </div>

      {/* Result. Keyed on the category so the whole panel remounts and the
          cascade replays on every change. No divider: the gap does that job. */}
      <div key={category.id} className="max-w-md">
        {/* The same drawn scene each tool has on the tools page, no pictures.
            It shows the lead tool and swaps to whichever row is hovered. */}
        <div
          className={`${styles.item} group border-border/60 bg-card/60 relative grid overflow-hidden rounded-xl border [--card-accent:var(--cat-active)]`}
          style={{ animationDelay: "0ms" }}
        >
          {picks.map((tool, j) => (
            <div
              key={tool.id}
              className={`col-start-1 row-start-1 transition-opacity duration-300 ease-out ${
                (hovered ?? 0) === j ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <Emblem tool={tool} />
            </div>
          ))}
          <span className="bg-background/80 border-border/60 text-muted-foreground absolute bottom-3 left-3 rounded-full border px-2.5 py-1 font-mono text-[10px] backdrop-blur">
            {picks[hovered ?? 0].shortName}
          </span>
        </div>

        <div className={styles.item} style={{ animationDelay: "60ms" }}>
          <div className="mt-5 flex items-start gap-3">
            <Icon
              className="mt-0.5 size-4 shrink-0 text-[var(--cat-active)]"
              aria-hidden
              strokeWidth={2}
            />
            <p className="text-muted-foreground text-[13px] leading-relaxed">
              {category.description}
            </p>
          </div>
        </div>

        {/* The tools themselves, as rows you can jump straight into. Hovering
            a row lights its piece of the mosaic above. */}
        <ul className="mt-6" onMouseLeave={() => setHovered(null)}>
          {picks.map((tool, j) => (
            <li
              key={tool.id}
              className={styles.item}
              style={{ animationDelay: `${110 + j * 55}ms` }}
              onMouseEnter={() => setHovered(j)}
            >
              <Link
                href={tool.slug}
                className="group/row flex items-center justify-between gap-4 py-2"
              >
                <span className="text-muted-foreground group-hover/row:text-foreground text-lg font-medium tracking-tight transition-colors">
                  {tool.name}
                </span>
                <ArrowUpRightIcon
                  className="text-muted-foreground/25 group-hover/row:text-[var(--cat-active)] size-4 shrink-0 transition-all duration-200 group-hover/row:-translate-y-0.5 group-hover/row:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>

        <div className={styles.item} style={{ animationDelay: `${110 + picks.length * 55}ms` }}>
          <Link
            href={`/tools#cat-${category.id}`}
            className="group/cta mt-5 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-[var(--cat-active)] uppercase"
          >
            All of {category.label}
            <ArrowRightIcon
              className="size-3.5 transition-transform group-hover/cta:translate-x-1"
              aria-hidden
            />
          </Link>
        </div>
      </div>

      {/* Affordance sits under the thing it describes, not in the result. */}
      <p className="text-muted-foreground/45 absolute bottom-0 left-0 font-mono text-[10px] tracking-[0.2em] uppercase">
        Scroll, drag or arrow
      </p>
    </div>
  );
}
