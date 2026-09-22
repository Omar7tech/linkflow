"use client";

import { useEffect, useRef } from "react";
import {
  ChevronDownIcon, ChevronUpIcon, CopyIcon, EyeIcon, EyeOffIcon, PlusIcon, SmileIcon, Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  EMOJI_SETS, bool, defOf, rows, slugify, str,
  type Block, type Field, type PropValue, type Row,
} from "@/lib/site-builder";
import { ImageField } from "./image-field";

export interface AnchorOption {
  value: string;
  label: string;
}

interface InspectorProps {
  block: Block;
  anchors: AnchorOption[];
  anchor: string;
  focus: string;
  onProps: (patch: Record<string, PropValue>, tag?: string) => void;
  onVariant: (variant: string) => void;
  onHidden: (hidden: boolean) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function Inspector({ block, anchors, anchor, focus, onProps, onVariant, onHidden, onDuplicate, onDelete }: InspectorProps) {
  const def = defOf(block.type);
  const shell = useRef<HTMLDivElement>(null);

  // A click on the page opens the matching field, already focused.
  useEffect(() => {
    if (!focus || !shell.current) return;
    const target = shell.current.querySelector<HTMLElement>(`[data-field="${CSS.escape(focus)}"]`);
    if (!target) return;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    target.querySelector<HTMLInputElement>("input, textarea")?.focus();
  }, [focus, block.id]);

  return (
    <div ref={shell} className="flex h-full min-h-0 flex-col">
      <header className="border-border/70 flex items-start gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-semibold">{def.name}</p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-4">{def.blurb}</p>
        </div>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon-sm" aria-label={block.hidden ? "Show section" : "Hide section"} onClick={() => onHidden(!block.hidden)}>
            {block.hidden ? <EyeOffIcon /> : <EyeIcon />}
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Duplicate section" onClick={onDuplicate}>
            <CopyIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Delete section" onClick={onDelete}>
            <Trash2Icon />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {def.variants.length > 1 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Layout</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {def.variants.map((variant) => (
                <button
                  key={variant.value}
                  onClick={() => onVariant(variant.value)}
                  className={cn(
                    "rounded-lg border px-2.5 py-2 text-left text-xs transition-colors",
                    block.variant === variant.value
                      ? "border-primary bg-primary/10 text-foreground font-medium"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                  )}
                >
                  {variant.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {def.fields.map((field) => (
          <FieldRow key={field.key} field={field} block={block} anchors={anchors} onProps={onProps} />
        ))}

        <details className="border-border/70 border-t pt-3">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">Section link name</summary>
          <div className="mt-2 space-y-1.5">
            <Input
              aria-label="Section link name"
              value={anchor}
              onChange={(event) => onProps({ anchor: slugify(event.target.value) }, `anchor-${block.id}`)}
            />
            <p className="text-muted-foreground text-[11px] leading-4">
              Menu links point here as <code>#{anchor || "section"}</code>.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ fields */

function FieldRow({
  field, block, anchors, onProps,
}: {
  field: Field;
  block: Block;
  anchors: AnchorOption[];
  onProps: (patch: Record<string, PropValue>, tag?: string) => void;
}) {
  const tag = `${block.id}-${field.key}`;

  if (field.kind === "list") return <ListField field={field} block={block} anchors={anchors} onProps={onProps} />;

  if (field.kind === "toggle") {
    return (
      <div data-field={field.key} className="flex items-center justify-between gap-3 py-0.5">
        <Label htmlFor={`${tag}-input`} className="text-xs font-normal">{field.label}</Label>
        <Switch id={`${tag}-input`} checked={bool(block, field.key)} onCheckedChange={(next) => onProps({ [field.key]: next })} />
      </div>
    );
  }

  const value = str(block, field.key);
  const set = (next: string) => onProps({ [field.key]: next }, tag);

  return (
    <div data-field={field.key} className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={`${tag}-input`} className="text-xs">{field.label}</Label>
        {field.max && field.kind !== "select" && field.kind !== "image" && (
          <span className={cn("text-[10px] tabular-nums", value.length > field.max ? "text-amber-600" : "text-muted-foreground/70")}>
            {value.length}/{field.max}
          </span>
        )}
      </div>

      <FieldControl id={`${tag}-input`} field={field} value={value} anchors={anchors} onChange={set} />

      {field.help && <p className="text-muted-foreground text-[11px] leading-4">{field.help}</p>}
    </div>
  );
}

function FieldControl({
  id, field, value, anchors, onChange,
}: {
  id: string;
  field: Field;
  value: string;
  anchors: AnchorOption[];
  onChange: (next: string) => void;
}) {
  switch (field.kind) {
    case "textarea":
      return (
        <Textarea
          id={id}
          value={value}
          rows={field.max && field.max > 400 ? 8 : 3}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-[72px] text-sm"
        />
      );
    case "image":
      return <ImageField value={value} onChange={onChange} />;
    case "emoji":
      return <EmojiField id={id} value={value} onChange={onChange} />;
    case "select":
      return (
        <Select value={value || field.options?.[0]?.value || ""} onValueChange={onChange}>
          <SelectTrigger id={id} className="h-9 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "anchor":
      return <AnchorField id={id} value={value} anchors={anchors} onChange={onChange} />;
    default:
      return (
        <Input
          id={id}
          value={value}
          placeholder={field.placeholder}
          inputMode={field.kind === "url" ? "url" : undefined}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 text-sm"
        />
      );
  }
}

const LINK_KINDS = [
  { value: "__email", label: "An email address" },
  { value: "__phone", label: "A phone number" },
  { value: "__web", label: "Another website" },
];

/**
 * Non-developers do not think in URLs. This offers the page's own sections
 * first, then the three other things a button ever points at.
 */
function AnchorField({
  id, value, anchors, onChange,
}: {
  id: string;
  value: string;
  anchors: AnchorOption[];
  onChange: (next: string) => void;
}) {
  const matched = anchors.find((option) => option.value === value);
  const kind = matched ? value : value.startsWith("mailto:") ? "__email" : value.startsWith("tel:") ? "__phone" : "__web";

  return (
    <div className="space-y-1.5">
      <Select
        value={kind}
        onValueChange={(next) => {
          if (next === "__email") onChange("mailto:");
          else if (next === "__phone") onChange("tel:");
          else if (next === "__web") onChange("https://");
          else onChange(next);
        }}
      >
        <SelectTrigger id={id} className="h-9 w-full text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {anchors.length > 0 && (
            <SelectGroup>
              <SelectLabel>A section on this page</SelectLabel>
              {anchors.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectGroup>
          )}
          <SelectGroup>
            <SelectLabel>Somewhere else</SelectLabel>
            {LINK_KINDS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {!matched && (
        <Input
          aria-label="Link address"
          value={value}
          placeholder={kind === "__email" ? "mailto:you@example.com" : kind === "__phone" ? "tel:+351900000000" : "https://example.com"}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 text-sm"
        />
      )}
    </div>
  );
}

function EmojiField({ id, value, onChange }: { id: string; value: string; onChange: (next: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button id={id} variant="outline" className="h-9 w-12 px-0 text-lg" aria-label="Choose an icon">
            {value || <SmileIcon className="size-4" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {EMOJI_SETS.map((set) => (
              <div key={set.name}>
                <p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wider">{set.name}</p>
                <div className="grid grid-cols-6 gap-0.5">
                  {set.emoji.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => onChange(emoji)}
                      className="hover:bg-muted rounded p-1.5 text-lg leading-none"
                      aria-label={`Use ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Input value={value} onChange={(event) => onChange(event.target.value.slice(0, 4))} className="h-9 text-sm" aria-label="Icon" />
      {value && (
        <Button variant="ghost" size="icon-sm" aria-label="Clear icon" onClick={() => onChange("")}>
          <Trash2Icon />
        </Button>
      )}
    </div>
  );
}

function ListField({
  field, block, anchors, onProps,
}: {
  field: Field;
  block: Block;
  anchors: AnchorOption[];
  onProps: (patch: Record<string, PropValue>, tag?: string) => void;
}) {
  const items = rows(block, field.key);
  const max = field.max ?? 12;
  const itemName = field.itemName ?? "item";

  const write = (next: Row[], tag?: string) => onProps({ [field.key]: next }, tag);
  const patchRow = (index: number, key: string, value: string) =>
    write(items.map((row, i) => (i === index ? { ...row, [key]: value } : row)), `${block.id}-${field.key}-${index}-${key}`);
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    write(next);
  };

  return (
    <div data-field={field.key} className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{field.label}</Label>
        <span className="text-muted-foreground/70 text-[10px] tabular-nums">{items.length}/{max}</span>
      </div>

      <div className="space-y-2">
        {items.map((row, index) => (
          <div key={index} data-field={`${field.key}.${index}`} className="border-border/80 bg-muted/25 rounded-lg border p-2.5">
            <div className="mb-2 flex items-center gap-1">
              <span className="text-muted-foreground flex-1 truncate text-[11px] font-medium">
                {row[field.fields?.[0].key ?? ""] || `${itemName} ${index + 1}`}
              </span>
              <Button variant="ghost" size="icon-sm" aria-label={`Move ${itemName} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                <ChevronUpIcon />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Move ${itemName} down`} disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                <ChevronDownIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${itemName}`}
                onClick={() => write(items.filter((_, i) => i !== index))}
              >
                <Trash2Icon />
              </Button>
            </div>
            <div className="space-y-2.5">
              {field.fields?.map((sub) => (
                <div key={sub.key} data-field={`${field.key}.${index}.${sub.key}`} className="space-y-1">
                  <Label htmlFor={`${block.id}-${field.key}-${index}-${sub.key}`} className="text-muted-foreground text-[11px] font-normal">
                    {sub.label}
                  </Label>
                  <FieldControl
                    id={`${block.id}-${field.key}-${index}-${sub.key}`}
                    field={sub}
                    value={row[sub.key] ?? ""}
                    anchors={anchors}
                    onChange={(next) => patchRow(index, sub.key, next)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={items.length >= max}
        onClick={() => write([...items, { ...(field.item ?? {}) }])}
      >
        <PlusIcon />
        Add {itemName}
      </Button>
    </div>
  );
}
