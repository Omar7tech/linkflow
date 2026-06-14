"use client";

import { useEffect } from "react";
import Link from "next/link";
import { HomeIcon, RotateCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <p className="font-heading text-primary text-7xl font-bold tracking-tight tabular-nums sm:text-8xl">
        500
      </p>
      <h1 className="font-heading mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
        Something broke on our end
      </h1>
      <p className="text-muted-foreground mt-3 max-w-md text-balance leading-relaxed">
        An unexpected error stopped this page from loading. Your data never leaves the browser, so
        nothing was lost. Try again, and if it keeps happening, head back home.
      </p>

      {error.digest ? (
        <p className="text-muted-foreground/70 mt-4 font-mono text-xs">
          Reference: {error.digest}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
        <Button size="lg" onClick={() => unstable_retry()}>
          <RotateCwIcon data-icon="inline-start" aria-hidden />
          Try again
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">
            <HomeIcon data-icon="inline-start" aria-hidden />
            Back home
          </Link>
        </Button>
      </div>
    </div>
  );
}
