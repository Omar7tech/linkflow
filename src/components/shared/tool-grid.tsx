import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { TOOLS } from "@/constants/tools";
import { cn } from "@/lib/utils";
import { ToolIcon } from "./tool-icon";

export function ToolGrid({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {TOOLS.map((tool) => (
        <Link
          key={tool.id}
          href={tool.slug}
          className="group border-border bg-card hover:border-foreground/20 relative flex flex-col gap-3 rounded-xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="border-border bg-muted/40 flex size-10 items-center justify-center rounded-lg border">
              <ToolIcon name={tool.icon} className={cn("size-5", tool.accent)} />
            </span>
            <ArrowRightIcon className="text-muted-foreground size-4 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
          </div>
          <div>
            <h3 className="font-semibold">{tool.shortName}</h3>
            <p className="text-muted-foreground mt-1 text-sm">{tool.tagline}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
