import Link from "next/link";
import { TOOLS } from "@/constants/tools";
import { SITE } from "@/constants/site";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="border-border/60 mt-auto border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="text-muted-foreground text-sm">
            {SITE.tagline} Free, fast and private — no accounts, no tracking, nothing logged.
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
        <div className="mx-auto max-w-6xl px-4">
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