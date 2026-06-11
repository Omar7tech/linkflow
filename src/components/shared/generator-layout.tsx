import { cn } from "@/lib/utils";
import type { ToolMeta } from "@/types";
import { ToolIcon } from "./tool-icon";

interface GeneratorLayoutProps {
  tool: ToolMeta;
  /** The form column. */
  children: React.ReactNode;
  /** The live output column (sticky on desktop). */
  output: React.ReactNode;
  /** Full-width content below the grid — history, tips, FAQ. */
  footer?: React.ReactNode;
}

export function GeneratorLayout({ tool, children, output, footer }: GeneratorLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <header className="mb-8 max-w-2xl">
        <div className="mb-3 flex items-center gap-3">
          <span className="border-border bg-muted/40 flex size-11 items-center justify-center rounded-xl border">
            <ToolIcon name={tool.icon} className={cn("size-5", tool.accent)} />
          </span>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tool.name}</h1>
        </div>
        <p className="text-muted-foreground">{tool.description}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,420px)]">
        <div className="min-w-0">{children}</div>
        <div className="min-w-0">
          <div className="lg:sticky lg:top-20">{output}</div>
        </div>
      </div>

      {footer && <div className="mt-8 space-y-6">{footer}</div>}
    </div>
  );
}
