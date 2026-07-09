import type { ToolMeta } from "@/types";
import { FavoriteButton } from "./favorite-button";

interface GeneratorLayoutProps {
  tool: ToolMeta;
  /** The form column. */
  children: React.ReactNode;
  /** The live output column (sticky on desktop). */
  output: React.ReactNode;
  /** Give the output column most of the width — for visual tools where the preview is the star. */
  wideOutput?: boolean;
  /** Full-width content below the grid — history, tips, FAQ. */
  footer?: React.ReactNode;
}

export function GeneratorLayout({ tool, children, output, wideOutput, footer }: GeneratorLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-12">
      <header className="mb-8 max-w-2xl">
        <div className="mb-3 flex items-center gap-3">
          <span className="border-border bg-card flex size-11 items-center justify-center rounded-xl border">
            <tool.icon className="text-foreground/80 size-5" aria-hidden />
          </span>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{tool.name}</h1>
          <FavoriteButton toolId={tool.id} className="mt-1 [&>svg]:size-5" />
        </div>
        <p className="text-muted-foreground">{tool.description}</p>
      </header>

      <div
        className={
          output
            ? wideOutput
              ? "grid gap-6 lg:grid-cols-[minmax(300px,360px)_1fr]"
              : "grid gap-6 lg:grid-cols-[1fr_minmax(320px,420px)]"
            : "w-full"
        }
      >
        <div className="min-w-0">{children}</div>
        {output && (
          <div className={wideOutput ? "order-first min-w-0 lg:order-none" : "min-w-0"}>
            <div className="lg:sticky lg:top-20">{output}</div>
          </div>
        )}
      </div>

      {footer && <div className="mt-8 space-y-6">{footer}</div>}
    </div>
  );
}
