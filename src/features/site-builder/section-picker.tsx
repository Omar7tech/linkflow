"use client";

import { useState } from "react";
import {
  BadgeCheckIcon, CircleHelpIcon, ColumnsIcon, ImagesIcon, LayoutGridIcon, ListOrderedIcon, MailIcon,
  MegaphoneIcon, MenuIcon, MinusIcon, MousePointerClickIcon, PanelBottomIcon, PlayIcon, QuoteIcon,
  SendIcon, SparklesIcon, TagIcon, TrendingUpIcon, TypeIcon, UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BLOCKS, type BlockGroup, type BlockType } from "@/lib/site-builder";

const ICONS: Record<string, LucideIcon> = {
  MegaphoneIcon, MenuIcon, SparklesIcon, BadgeCheckIcon, LayoutGridIcon, ColumnsIcon, TrendingUpIcon,
  ListOrderedIcon, ImagesIcon, TagIcon, QuoteIcon, CircleHelpIcon, UsersIcon, TypeIcon,
  MousePointerClickIcon, MailIcon, SendIcon, PlayIcon, MinusIcon, PanelBottomIcon,
};

const GROUPS: BlockGroup[] = ["Header", "Opening", "Content", "Proof", "Offer", "Contact", "Closing"];

interface SectionPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (type: BlockType) => void;
  /** Sections already on the page — the once-only ones get greyed out. */
  present: BlockType[];
}

export function SectionPicker({ open, onOpenChange, onPick, present }: SectionPickerProps) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = BLOCKS.filter(
    (def) => !needle || def.name.toLowerCase().includes(needle) || def.blurb.toLowerCase().includes(needle) || def.type.includes(needle),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-heading">Add a section</DialogTitle>
          <DialogDescription>Each one arrives filled in with example content you can edit straight away.</DialogDescription>
        </DialogHeader>

        <Input
          autoFocus
          aria-label="Search sections"
          placeholder="Search sections: pricing, gallery, questions"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="space-y-5">
          {GROUPS.map((group) => {
            const items = matches.filter((def) => def.group === group);
            if (!items.length) return null;
            return (
              <section key={group}>
                <p className="text-muted-foreground mb-2 text-[11px] font-medium uppercase tracking-wider">{group}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((def) => {
                    const Icon = ICONS[def.icon] ?? SparklesIcon;
                    const taken = !!def.once && present.includes(def.type);
                    return (
                      <button
                        key={def.type}
                        disabled={taken}
                        onClick={() => {
                          onPick(def.type);
                          onOpenChange(false);
                          setQuery("");
                        }}
                        className={cn(
                          "group flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                          taken
                            ? "border-border/60 cursor-not-allowed opacity-45"
                            : "border-border hover:border-primary/50 hover:bg-muted/40",
                        )}
                      >
                        <span className="bg-muted text-foreground/80 group-hover:bg-primary/10 group-hover:text-primary grid size-8 shrink-0 place-items-center rounded-lg transition-colors">
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{def.name}</span>
                          <span className="text-muted-foreground mt-0.5 block text-xs leading-4">
                            {taken ? "Already on the page" : def.blurb}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {!matches.length && <p className="text-muted-foreground py-8 text-center text-sm">Nothing matches “{query}”.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
