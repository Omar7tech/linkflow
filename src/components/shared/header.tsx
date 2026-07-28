"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { Logo } from "./logo";
import { MobileNavPanel, MobileNavTrigger } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";

type NavLink = { href: string; label: string; badge?: string };

const PRIMARY_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/tools", label: "Tools" },
  { href: "/icons", label: "Icons" },
  { href: "/docs", label: "Docs" },
  { href: "/books", label: "Books" },
];

const SECONDARY_LINKS: NavLink[] = [
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
];

function NavItem({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      className={cn(
        "text-muted-foreground hover:text-foreground inline-flex items-center rounded-lg px-3 py-1.5 text-sm transition-colors",
        active && "text-foreground bg-muted"
      )}
    >
      {link.label}
      {link.badge && (
        <span className="ml-1.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
          {link.badge}
        </span>
      )}
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="border-border/60 bg-background/70 sticky top-0 z-50 border-b backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Forma home">
          <Logo className="[&_span:last-child]:hidden sm:[&_span:last-child]:inline" />
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
          {PRIMARY_LINKS.map((link) => (
            <NavItem key={link.href} link={link} active={pathname === link.href} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <nav className="mr-1 hidden items-center gap-1 md:flex" aria-label="Secondary">
            {SECONDARY_LINKS.map((link) => (
              <NavItem key={link.href} link={link} active={pathname === link.href} />
            ))}
          </nav>
          <CommandPalette />
          <ThemeToggle />
          <MobileNavTrigger open={mobileOpen} onToggle={() => setMobileOpen((o) => !o)} />
        </div>
      </div>

      <MobileNavPanel open={mobileOpen} onNavigate={() => setMobileOpen(false)} />
    </header>
  );
}
