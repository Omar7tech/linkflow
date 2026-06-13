import { cn } from "@/lib/utils";

/** Forma mark — a standalone geometric "f" with an emerald crossbar. No container. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} fill="none" aria-hidden>
      {/* Stem + top hook of the f */}
      <path
        d="M11 28 V12 A7 7 0 0 1 18 5 H21"
        className="stroke-foreground"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Crossbar */}
      <path
        d="M5 15 H17"
        className="stroke-foreground"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      {/* Dot — the brand accent */}
      <circle cx="21.5" cy="26" r="2.2" className="fill-primary" />
    </svg>
  );
}

export function Logo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      {withWordmark && (
        <span className="font-heading text-[17px] font-bold tracking-tight">
          forma<span className="text-primary"> tools.</span>
        </span>
      )}
    </span>
  );
}
