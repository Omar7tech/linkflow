"use client";

import { Geist, Space_Grotesk } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <title>Something went wrong</title>
      <body className="bg-background text-foreground flex min-h-screen flex-col">
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
          <p className="font-heading text-primary text-7xl font-bold tracking-tight tabular-nums sm:text-8xl">
            500
          </p>
          <h1 className="font-heading mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
            Something went wrong
          </h1>
          <p className="text-muted-foreground mt-3 max-w-md text-balance leading-relaxed">
            A critical error stopped the app from loading. Nothing you typed was sent anywhere. Try
            reloading the page.
          </p>

          {error.digest ? (
            <p className="text-muted-foreground/70 mt-4 font-mono text-xs">
              Reference: {error.digest}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => unstable_retry()}
            className="bg-primary text-primary-foreground hover:bg-primary/80 mt-8 inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
