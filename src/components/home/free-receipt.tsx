import Link from "next/link";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Every line is checked against the repo, not asserted: no auth library, no
 * analytics or tracker scripts, no paywalled routes, and the FAQ already states
 * no usage limits, accounts or watermarks.
 */
const INCLUDED = [
  "Every tool and every feature",
  "No sign-up and no email",
  "No watermarks on anything you export",
  "Links that never expire",
  "No ads and no trackers",
];

/**
 * "It's free" told in the format people already trust for prices: a plan card.
 * There is only one plan, and it costs nothing.
 */
export function FreeReceipt() {
  return (
    <div className="border-border/60 bg-card relative w-full max-w-md overflow-hidden rounded-2xl border p-7 shadow-[0_24px_48px_-28px_rgb(0_0_0/0.35)]">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent)]"
      />

      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs font-medium">
            Free
          </span>
          <span className="text-muted-foreground text-xs">The only plan</span>
        </div>

        <p className="mt-6 flex items-baseline gap-2">
          <span className="font-heading text-6xl font-bold tracking-tight">$0</span>
          <span className="text-muted-foreground text-sm">forever</span>
        </p>
        <p className="text-muted-foreground mt-2 text-sm">
          Everything is included. There is nothing to unlock later.
        </p>

        <ul className="border-border/60 mt-6 space-y-3 border-t pt-6">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm">
              <span className="bg-primary/10 text-primary grid size-5 shrink-0 place-items-center rounded-full">
                <CheckIcon className="size-3" strokeWidth={3} aria-hidden />
              </span>
              {item}
            </li>
          ))}
        </ul>

        <Button asChild className="mt-7 h-11 w-full rounded-full">
          <Link href="/tools">
            Browse all tools
            <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
        </Button>
        <p className="text-muted-foreground/70 mt-3 text-center text-xs">
          No card, no trial, no upgrade page.
        </p>
      </div>
    </div>
  );
}
