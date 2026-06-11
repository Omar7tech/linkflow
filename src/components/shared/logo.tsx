import { cn } from "@/lib/utils";

/** LinkFlow mark — two interlocked link pills on a squircle. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="9.6" className="fill-foreground" />
      <g
        transform="rotate(-30 16 16)"
        fill="none"
        className="stroke-background"
        strokeWidth="2.4"
      >
        <rect x="5.4" y="13.1" width="12.2" height="5.8" rx="2.9" />
        <rect x="14.4" y="13.1" width="12.2" height="5.8" rx="2.9" />
      </g>
    </svg>
  );
}

export function Logo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {withWordmark && (
        <span className="font-heading text-[17px] font-bold tracking-tight">linkflow</span>
      )}
    </span>
  );
}
