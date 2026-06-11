import Link from "next/link";
import { Link2Icon } from "lucide-react";
import { TOOLS } from "@/constants/tools";
import { SITE } from "@/constants/site";

export function Footer() {
  return (
    <footer className="border-border/60 mt-auto border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-semibold">
            <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg">
              <Link2Icon className="size-4" />
            </span>
            LinkFlow
          </div>
          <p className="text-muted-foreground text-sm">
            {SITE.tagline} Every tool runs entirely in your browser — your data never leaves your
            device.
          </p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">Generators</h3>
          <ul className="space-y-2 text-sm">
            {TOOLS.slice(0, 5).map((tool) => (
              <li key={tool.id}>
                <Link href={tool.slug} className="text-muted-foreground hover:text-foreground">
                  {tool.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">More tools</h3>
          <ul className="space-y-2 text-sm">
            {TOOLS.slice(5).map((tool) => (
              <li key={tool.id}>
                <Link href={tool.slug} className="text-muted-foreground hover:text-foreground">
                  {tool.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">Company</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/tools" className="text-muted-foreground hover:text-foreground">
                All tools
              </Link>
            </li>
            <li>
              <Link href="/faq" className="text-muted-foreground hover:text-foreground">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/about" className="text-muted-foreground hover:text-foreground">
                About
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-border/60 border-t py-5">
        <p className="text-muted-foreground mx-auto max-w-6xl px-4 text-xs">
          © {new Date().getFullYear()} {SITE.name}. Free forever. No tracking, no accounts, no
          servers.
        </p>
      </div>
    </footer>
  );
}
