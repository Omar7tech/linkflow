import { cn } from "@/lib/utils";

/** Forma mark — a geometric "f" curve with a vermilion point, on a rounded square. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-foreground" />
      <path
        d="M10 24 V14.5 A6.5 6.5 0 0 1 16.5 8 H22"
        fill="none"
        className="stroke-background"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="20.75" cy="20.75" r="3.4" className="fill-primary" />
    </svg>
  );
}

export function Logo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {withWordmark && (
        <span className="font-heading text-[17px] font-bold tracking-tight">
          forma<span className="text-primary">.</span>
        </span>
      )}
    </span>
  );
}
