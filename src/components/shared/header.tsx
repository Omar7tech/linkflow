"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Link2Icon, MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TOOLS } from "@/constants/tools";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { ThemeToggle } from "./theme-toggle";
import { ToolIcon } from "./tool-icon";

const NAV_LINKS = [
  { href: "/tools", label: "Tools" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="border-border/60 bg-background/70 sticky top-0 z-50 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="LinkFlow home">
          <span className="from-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg bg-gradient-to-br to-[oklch(0.6_0.18_250)] text-white shadow-[0_0_16px_var(--glow)]">
            <Link2Icon className="size-4" />
          </span>
          <span className="font-heading hidden font-bold sm:inline">LinkFlow</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-muted-foreground hover:text-foreground rounded-lg px-3 py-1.5 text-sm transition-colors",
                pathname === link.href && "text-foreground bg-muted"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <CommandPalette />
          <ThemeToggle />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>LinkFlow</SheetTitle>
              </SheetHeader>
              <nav className="grid gap-1 px-4 pb-6" aria-label="Mobile">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="hover:bg-muted rounded-lg px-3 py-2 text-sm font-medium"
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="text-muted-foreground mt-3 px-3 text-xs font-medium uppercase tracking-wide">
                  Tools
                </div>
                {TOOLS.map((tool) => (
                  <Link
                    key={tool.id}
                    href={tool.slug}
                    onClick={() => setMobileOpen(false)}
                    className="hover:bg-muted flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm"
                  >
                    <ToolIcon name={tool.icon} className={cn("size-4", tool.accent)} />
                    {tool.shortName}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
