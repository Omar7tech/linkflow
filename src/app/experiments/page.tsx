import type { Metadata } from "next";
import { ToolCard } from "@/components/shared/tool-grid";
import { SITE } from "@/constants/site";
import { EXPERIMENTS } from "@/constants/tools";

export const metadata: Metadata = {
  title: "Experiments",
  description:
    "Things built for the fun of it: watch sorting and pathfinding algorithms think, hide a word in a Magic Eye picture, or bury a message in the spectrogram of a sound.",
  alternates: { canonical: `${SITE.url}/experiments` },
};

export default function ExperimentsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12">
      <header className="mb-8 max-w-2xl">
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">Experiments</h1>
        <p className="text-muted-foreground mt-2">
          Not tools for a job, just things worth playing with: algorithms you can watch think, and
          pictures and sounds with something hidden inside.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXPERIMENTS.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
}
