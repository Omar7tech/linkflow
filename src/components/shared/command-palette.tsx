"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { HelpCircleIcon, HomeIcon, InfoIcon, MoonIcon, SunIcon } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { TOOLS } from "@/constants/tools";

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground border-border bg-muted/40 hover:bg-muted inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-sm transition-colors"
        aria-label="Open command palette"
      >
        <span className="hidden sm:inline">Search tools…</span>
        <kbd className="bg-background pointer-events-none rounded border px-1.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Command palette">
        <Command>
          <CommandInput placeholder="Jump to a tool or page…" />
          <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Tools">
            {TOOLS.map((tool) => (
              <CommandItem
                key={tool.id}
                value={`${tool.name} ${tool.keywords.join(" ")}`}
                onSelect={() => run(() => router.push(tool.slug))}
              >
                <tool.icon className="text-muted-foreground size-4" aria-hidden />
                <span>{tool.shortName}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Pages">
            <CommandItem onSelect={() => run(() => router.push("/"))}>
              <HomeIcon className="size-4" /> Home
            </CommandItem>
            <CommandItem onSelect={() => run(() => router.push("/faq"))}>
              <HelpCircleIcon className="size-4" /> FAQ
            </CommandItem>
            <CommandItem onSelect={() => run(() => router.push("/about"))}>
              <InfoIcon className="size-4" /> About
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Theme">
            <CommandItem onSelect={() => run(() => setTheme("light"))}>
              <SunIcon className="size-4" /> Light mode
            </CommandItem>
            <CommandItem onSelect={() => run(() => setTheme("dark"))}>
              <MoonIcon className="size-4" /> Dark mode
            </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
