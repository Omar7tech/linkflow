import Link from "next/link";
import { TOOLS } from "@/constants/tools";
import { SITE } from "@/constants/site";
import { LinkLoadingIndicator } from "./link-indicator";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="border-border/60 relative mt-auto overflow-hidden border-t">
      {/* Square grid fading in from the top — a soft graph-paper backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] bg-[size:36px_36px] opacity-40 mask-[linear-gradient(to_bottom,black,transparent_75%)]"
      />
      {/* Emerald glow blooming from the bottom edge */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-64 bg-[radial-gradient(ellipse_60%_100%_at_50%_100%,rgba(52,211,153,0.14),transparent)]"
      />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3 lg:col-span-2">
          <Logo />
          <p className="text-muted-foreground max-w-xs text-sm">
            {SITE.tagline} Free, fast and private — no accounts, no tracking, nothing logged.
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">Popular tools</h3>
          <ul className="space-y-2 text-sm">
            {TOOLS.slice(0, 5).map((tool) => (
              <li key={tool.id}>
                <Link
                  href={tool.slug}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  {tool.name}
                  <LinkLoadingIndicator />
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/tools"
                className="text-foreground inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
              >
                All tools
                <LinkLoadingIndicator />
              </Link>
            </li>
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
        <div className="mx-auto max-w-7xl px-4">
          <p className="text-muted-foreground text-xs">
            © {new Date().getFullYear()} {SITE.name}. Free forever. No tracking, no accounts.
          </p>

          <p className="text-muted-foreground mt-2 text-xs">
            Developed by{" "}
            <a
              href="https://github.com/Omar7tech"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground font-medium transition-colors"
            >
              Omar Abi Farraj
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}