"use client";

import * as React from "react";
import { BookmarkIcon, BookmarkPlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Preset } from "@/types";

interface PresetsBarProps<T extends Record<string, unknown>> {
  presets: Preset<T>[];
  onSave: (name: string, values: T) => void;
  onDelete: (id: string) => void;
  onApply: (values: T) => void;
  /** Returns the current form values to snapshot. */
  getValues: () => T;
}

export function PresetsBar<T extends Record<string, unknown>>({
  presets,
  onSave,
  onDelete,
  onApply,
  getValues,
}: PresetsBarProps<T>) {
  const [name, setName] = React.useState("");
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <BookmarkIcon /> Presets
            {presets.length > 0 && (
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[10px]">
                {presets.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 space-y-3" align="start">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              onSave(name, getValues());
              toast.success(`Preset "${name.trim()}" saved`);
              setName("");
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name this configuration"
              aria-label="Preset name"
            />
            <Button type="submit" size="icon" variant="secondary" aria-label="Save preset">
              <BookmarkPlusIcon />
            </Button>
          </form>
          {presets.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Save the current form so you can reuse it later. Presets live in your browser only.
            </p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-auto">
              {presets.map((preset) => (
                <li key={preset.id} className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="flex-1 justify-start"
                    onClick={() => {
                      onApply(preset.values);
                      setOpen(false);
                      toast.success(`Preset "${preset.name}" applied`);
                    }}
                  >
                    {preset.name}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete preset ${preset.name}`}
                    onClick={() => onDelete(preset.id)}
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
