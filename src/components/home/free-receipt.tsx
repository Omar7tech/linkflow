import { SITE } from "@/constants/site";
import styles from "./free-receipt.module.css";

/**
 * Every line is checked against the repo, not asserted: no auth library, no
 * analytics or tracker scripts, no paywalled routes, and the FAQ already states
 * no usage limits, accounts or watermarks.
 */
const LINE_ITEMS = [
  "Every tool",
  "Sign-up",
  "Credit card",
  "Watermark removal",
  "Links that never expire",
  "Ads and trackers",
  "Unlocking a feature",
];

/**
 * The "it's free" claim as an itemised receipt. A list of prices that are all
 * zero makes the point far harder than a paragraph saying so, and the mono
 * type, dotted leaders and torn edge are already the site's own vocabulary.
 */
export function FreeReceipt() {
  return (
    <div className="w-full max-w-md">
      <div className="border-border/60 bg-card relative rounded-t-xl border border-b-0 px-6 pt-7 pb-8 font-mono">
        <p className="text-foreground text-center text-sm font-semibold tracking-[0.3em] uppercase">
          {SITE.name}
        </p>
        <p className="text-muted-foreground/60 mt-1.5 text-center text-[10px] tracking-[0.22em] uppercase">
          Everyday tool studio
        </p>

        <div className="border-border/70 mt-6 border-t border-dashed pt-5">
          <ul className="space-y-2.5">
            {LINE_ITEMS.map((item, i) => (
              <li
                key={item}
                className={`${styles.row} flex items-baseline gap-2 text-[13px]`}
                style={{ animationDelay: `${i * 55}ms` }}
              >
                <span className="text-muted-foreground shrink-0">{item}</span>
                <span
                  className="border-border/70 min-w-4 flex-1 translate-y-[-3px] border-b border-dotted"
                  aria-hidden
                />
                <span className="text-muted-foreground shrink-0 tabular-nums">0.00</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-border/70 mt-5 flex items-baseline gap-2 border-t border-dashed pt-5">
          <span className="text-foreground shrink-0 text-sm font-semibold tracking-[0.16em] uppercase">
            Total
          </span>
          <span className="min-w-4 flex-1" aria-hidden />
          <span className="text-primary shrink-0 text-lg font-bold tabular-nums">0.00</span>
        </div>

        <p className="text-muted-foreground/60 mt-6 text-center text-[10px] tracking-[0.18em] uppercase">
          Nothing to settle
        </p>

        <span
          className={`${styles.stamp} border-primary/50 text-primary/70 absolute right-5 -bottom-2 rounded-md border-2 px-3 py-1 text-xs font-bold tracking-[0.25em] uppercase`}
          style={{ animationDelay: `${LINE_ITEMS.length * 55 + 120}ms` }}
          aria-hidden
        >
          Paid
        </span>
      </div>

      {/* Torn off, rather than squared off */}
      <div className={styles.tear} aria-hidden />
    </div>
  );
}
