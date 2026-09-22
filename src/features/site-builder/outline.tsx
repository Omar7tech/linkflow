"use client";

import { useState } from "react";
import { CopyIcon, EyeOffIcon, GripVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { defOf, str, type Block } from "@/lib/site-builder";

interface OutlineProps {
  blocks: Block[];
  selected: string;
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onToggle: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

/** A one-line summary so the list reads like the page, not like a list of types. */
function summarise(block: Block): string {
  const first = str(block, "headline") || str(block, "heading") || str(block, "logoText") || str(block, "text") || str(block, "label");
  return first.trim().slice(0, 40);
}

export function Outline({ blocks, selected, onSelect, onReorder, onToggle, onDuplicate, onDelete, onAdd }: OutlineProps) {
  const [dragging, setDragging] = useState(-1);
  const [over, setOver] = useState(-1);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border/70 flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Sections</p>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onAdd}>
          <PlusIcon className="size-3.5" />
          Add
        </Button>
      </div>

      <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {blocks.map((block, index) => {
          const def = defOf(block.type);
          const summary = summarise(block);
          return (
            <li
              key={block.id}
              draggable
              onDragStart={() => setDragging(index)}
              onDragEnd={() => {
                setDragging(-1);
                setOver(-1);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragging >= 0 && dragging !== index) onReorder(dragging, index);
                setDragging(-1);
                setOver(-1);
              }}
              className={cn(
                "group relative rounded-lg transition-colors",
                over === index && dragging >= 0 && dragging !== index && "before:bg-primary before:absolute before:inset-x-1 before:-top-0.5 before:h-0.5 before:rounded-full",
                dragging === index && "opacity-40",
              )}
            >
              <button
                onClick={() => onSelect(block.id)}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-left transition-colors",
                  selected === block.id ? "bg-primary/10 text-foreground" : "hover:bg-muted/70 text-muted-foreground",
                  block.hidden && "opacity-50",
                )}
              >
                <GripVerticalIcon className="text-muted-foreground/50 size-3.5 shrink-0 cursor-grab" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-xs font-medium", selected === block.id ? "text-foreground" : "text-foreground/85")}>
                    {def.name}
                  </span>
                  {summary && <span className="text-muted-foreground block truncate text-[11px] leading-4">{summary}</span>}
                </span>
                {block.hidden && <EyeOffIcon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />}
              </button>

              <div className="bg-background/95 absolute right-1 top-1 hidden gap-0.5 rounded-md p-0.5 shadow-sm backdrop-blur group-hover:flex">
                <Button variant="ghost" size="icon-sm" className="size-6" aria-label={`${block.hidden ? "Show" : "Hide"} ${def.name}`} onClick={() => onToggle(block.id)}>
                  <EyeOffIcon className="size-3" />
                </Button>
                <Button variant="ghost" size="icon-sm" className="size-6" aria-label={`Duplicate ${def.name}`} onClick={() => onDuplicate(block.id)}>
                  <CopyIcon className="size-3" />
                </Button>
                <Button variant="ghost" size="icon-sm" className="size-6" aria-label={`Delete ${def.name}`} onClick={() => onDelete(block.id)}>
                  <Trash2Icon className="size-3" />
                </Button>
              </div>
            </li>
          );
        })}

        {!blocks.length && (
          <li className="text-muted-foreground px-2 py-6 text-center text-xs leading-5">
            No sections yet.
            <br />
            Add one to start building.
          </li>
        )}
      </ol>

      <div className="border-border/70 border-t p-2">
        <Button variant="outline" size="sm" className="w-full" onClick={onAdd}>
          <PlusIcon />
          Add a section
        </Button>
      </div>
    </div>
  );
}
