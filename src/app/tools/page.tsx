import type { Metadata } from "next";
import { ToolsBrowser } from "@/components/shared/tools-browser";
import { SITE } from "@/constants/site";

export const metadata: Metadata = {
  title: "All Tools",
  description: `Browse every ${SITE.name} generator — WhatsApp links, QR codes, share links, SMS, click-to-call, email, vCards, UTM campaign URLs, secure passwords, hash checksums, lorem ipsum text and reading time.`,
  alternates: { canonical: `${SITE.url}/tools` },
};

export default function ToolsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12">
      <header className="mb-8 max-w-2xl">
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">All tools</h1>
        <p className="text-muted-foreground mt-2">
          A focused generator for every job, all sharing the same instant-preview workflow — pick
          one and start creating.
        </p>
      </header>
      <ToolsBrowser />
    </div>
  );
}
