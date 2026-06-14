import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, WrenchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE } from "@/constants/site";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you are looking for doesn't exist or has moved.",
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE.url}/404` },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <p className="font-heading text-primary text-7xl font-bold tracking-tight tabular-nums sm:text-8xl">
        404
      </p>
      <h1 className="font-heading mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
        This page wandered off
      </h1>
      <p className="text-muted-foreground mt-3 max-w-md text-balance leading-relaxed">
        The page you&rsquo;re looking for doesn&rsquo;t exist, was moved, or the link was mistyped.
        Everything else is still here.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
        <Button asChild size="lg">
          <Link href="/">
            <ArrowLeftIcon data-icon="inline-start" aria-hidden />
            Back home
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/tools">
            <WrenchIcon data-icon="inline-start" aria-hidden />
            Browse the tools
          </Link>
        </Button>
      </div>
    </div>
  );
}
