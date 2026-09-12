"use client";

import { Fragment, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
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
      .slice(0, 5),
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

  const category = TOOL_CATEGORIES[index];
  const accent = accentFor(category.id);
  const picks = PICKS_BY_CATEGORY[category.id];
  const Icon = category.icon;

  return (
    <div
      className={`${styles.stage} relative grid grid-cols-[1.15fr_1fr] items-center gap-16`}
      style={
        { "--cat-light": accent.value.light, "--cat-dark": accent.value.dark } as CSSProperties
      }
    >
      {/* Wheel */}
      <div className="h-[32rem] [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]">
        <OptionWheel
          items={LABELS}
          defaultSelected={0}
          onChange={setIndex}
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

      {/* Hairline between the two halves, sitting on the grid seam */}
      <span aria-hidden className="bg-border absolute inset-y-6 left-[57%] w-px" />

      {/* Panel */}
      <div key={category.id} className={`${styles.panel} relative`}>
        <Icon
          className="size-7 text-[var(--cat-active)]"
          aria-hidden
          strokeWidth={1.5}
        />

        <span
          aria-hidden
          className="mt-5 block h-0.5 w-12 bg-[var(--cat-active)] transition-all"
        />

        <p className="text-foreground mt-5 max-w-sm text-lg leading-relaxed">
          {category.description}
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-xs tracking-[0.08em]">
          {picks.map((tool, j) => (
            <Fragment key={tool.id}>
              {j > 0 && (
                <span className="text-border" aria-hidden>
                  /
                </span>
              )}
              <Link
                href={tool.slug}
                className={`text-muted-foreground transition-colors ${accent.linkHover}`}
              >
                {tool.shortName}
              </Link>
            </Fragment>
          ))}
        </div>

        <Link
          href={`/tools#cat-${category.id}`}
          className="group/cta mt-8 inline-flex items-center gap-2 text-sm font-medium text-[var(--cat-active)]"
        >
          Open {category.label}
          <ArrowRightIcon
            className="size-4 transition-transform group-hover/cta:translate-x-0.5"
            aria-hidden
          />
        </Link>

        <p className="text-muted-foreground/50 mt-10 font-mono text-[10px] tracking-[0.2em] uppercase">
          Scroll, drag or arrow the wheel
        </p>
      </div>
    </div>
  );
}
