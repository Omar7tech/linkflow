"use client";

import * as React from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ImagePlusIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FONTS } from "@/lib/poster/fonts";
import { BANNER_STYLES, bannerSvg } from "@/lib/readme/banners";
import {
  BLOCK_INFO,
  uid,
  type Badge,
  type BadgeKind,
  type Block,
  type Project,
} from "@/lib/readme/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ bits */

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-muted-foreground flex items-baseline justify-between text-xs font-medium">
        {label}
        {hint && (
          <span className="text-muted-foreground/70 font-normal">{hint}</span>
        )}
      </span>
      {children}
    </label>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="bg-muted/60 flex gap-0.5 rounded-lg p-0.5"
    >
      {options.map(([v, l]) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-xs whitespace-nowrap transition-colors",
            value === v
              ? "bg-background font-medium shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1 text-sm">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

/** An editable list: each row renders its own fields, with move and remove. */
function List<T>({
  items,
  onChange,
  render,
  make,
  addLabel,
  max = 24,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (
    item: T,
    set: (patch: Partial<T>) => void,
    index: number,
  ) => React.ReactNode;
  make: () => T;
  addLabel: string;
  max?: number;
}) {
  const move = (i: number, d: number) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="group/row bg-muted/30 relative rounded-lg border p-2 pr-8"
        >
          {render(
            item,
            (patch) =>
              onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))),
            i,
          )}
          <div className="absolute top-1.5 right-1 flex flex-col opacity-60 transition-opacity group-hover/row:opacity-100">
            <button
              type="button"
              aria-label="Remove"
              className="hover:text-destructive grid size-6 place-items-center rounded"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <XIcon className="size-3.5" />
            </button>
            {i > 0 && (
              <button
                type="button"
                aria-label="Move up"
                className="hover:text-foreground text-muted-foreground grid size-6 place-items-center rounded"
                onClick={() => move(i, -1)}
              >
                <ArrowUpIcon className="size-3.5" />
              </button>
            )}
            {i < items.length - 1 && (
              <button
                type="button"
                aria-label="Move down"
                className="hover:text-foreground text-muted-foreground grid size-6 place-items-center rounded"
                onClick={() => move(i, 1)}
              >
                <ArrowDownIcon className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}
      {items.length < max && (
        <button
          type="button"
          onClick={() => onChange([...items, make()])}
          className="text-muted-foreground hover:text-foreground hover:border-primary/40 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-xs transition-colors"
        >
          <PlusIcon className="size-3.5" /> {addLabel}
        </button>
      )}
    </div>
  );
}

const small = "h-8 text-sm";
type Shot = Extract<Block, { type: "screenshots" }>["images"][number];

/* ------------------------------------------------------------- catalogues */

const BADGES: { kind: BadgeKind; label: string }[] = [
  { kind: "npm-version", label: "npm version" },
  { kind: "npm-downloads", label: "npm downloads" },
  { kind: "bundle", label: "Bundle size" },
  { kind: "license", label: "License" },
  { kind: "stars", label: "Stars" },
  { kind: "forks", label: "Forks" },
  { kind: "issues", label: "Open issues" },
  { kind: "last-commit", label: "Last commit" },
  { kind: "ci", label: "CI status" },
  { kind: "prs", label: "PRs welcome" },
  { kind: "custom", label: "Custom" },
];

export const SKILL_ICONS = [
  "ts",
  "js",
  "react",
  "nextjs",
  "vue",
  "nuxtjs",
  "svelte",
  "angular",
  "astro",
  "solidjs",
  "remix",
  "nodejs",
  "deno",
  "bun",
  "tailwind",
  "sass",
  "css",
  "html",
  "vite",
  "webpack",
  "express",
  "nestjs",
  "graphql",
  "prisma",
  "postgres",
  "mysql",
  "mongodb",
  "redis",
  "supabase",
  "firebase",
  "docker",
  "kubernetes",
  "aws",
  "gcp",
  "azure",
  "vercel",
  "netlify",
  "cloudflare",
  "git",
  "github",
  "githubactions",
  "linux",
  "py",
  "django",
  "fastapi",
  "flask",
  "go",
  "rust",
  "java",
  "kotlin",
  "swift",
  "flutter",
  "dart",
  "cpp",
  "c",
  "cs",
  "dotnet",
  "php",
  "laravel",
  "ruby",
  "rails",
  "threejs",
  "electron",
  "tauri",
  "redux",
  "jest",
  "vitest",
  "figma",
  "blender",
  "bash",
  "vim",
  "vscode",
  "materialui",
  "styledcomponents",
];

const LICENSES = [
  "MIT",
  "Apache-2.0",
  "GPL-3.0",
  "BSD-3-Clause",
  "ISC",
  "MPL-2.0",
  "LGPL-3.0",
  "AGPL-3.0",
  "Unlicense",
];
const LANGS = [
  ["ts", "TypeScript"],
  ["tsx", "TSX"],
  ["js", "JavaScript"],
  ["jsx", "JSX"],
  ["bash", "Shell"],
  ["json", "JSON"],
  ["py", "Python"],
  ["go", "Go"],
  ["rust", "Rust"],
  ["yaml", "YAML"],
  ["html", "HTML"],
  ["css", "CSS"],
  ["sql", "SQL"],
] as const;

const svgUrl = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/* ---------------------------------------------------------------- editor */

export function BlockEditor({
  block,
  project,
  dark,
  onChange,
}: {
  block: Block;
  project: Project;
  dark: boolean;
  onChange: (b: Block) => void;
}) {
  // Each case narrows `block`; `set` merges a patch of that same shape.
  const set = (patch: Partial<Block>) =>
    onChange({ ...block, ...patch } as Block);
  const titled = !!BLOCK_INFO[block.type].heading;
  const heading = titled ? (
    <Field label="Heading">
      <Input
        className={small}
        value={block.title ?? ""}
        onChange={(e) => set({ title: e.target.value })}
      />
    </Field>
  ) : null;

  switch (block.type) {
    case "banner":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {BANNER_STYLES.map((st) => (
              <BannerThumb
                dark={dark}
                key={st.id}
                active={block.style === st.id}
                label={st.label}
                url={svgUrl(
                  bannerSvg(st.id, {
                    title: project.name,
                    tagline: block.tagline,
                    accent: project.accent,
                    dark,
                    animated: false,
                    font:
                      FONTS.find((f) => f.id === block.font)?.family ??
                      "sans-serif",
                  }),
                )}
                onClick={() => set({ style: st.id })}
              />
            ))}
          </div>
          <Field label="Tagline">
            <Input
              className={small}
              value={block.tagline}
              onChange={(e) => set({ tagline: e.target.value })}
            />
          </Field>
          <Field label="Typeface">
            <Select
              value={block.font}
              onValueChange={(v) => set({ font: v as typeof block.font })}
            >
              <SelectTrigger className="h-8 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONTS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    <span style={{ fontFamily: f.family }}>{f.label}</span>
                    <span className="text-muted-foreground ml-1 text-xs">
                      {f.note}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      );

    case "badges":
      return (
        <div className="space-y-3">
          <Segmented
            label="Badge style"
            value={block.style}
            options={
              [
                ["flat", "Flat"],
                ["flat-square", "Square"],
                ["for-the-badge", "Bold"],
                ["plastic", "Plastic"],
              ] as const
            }
            onChange={(style) => set({ style })}
          />
          <List<Badge>
            items={block.items}
            onChange={(items) => set({ items })}
            addLabel="Add badge"
            max={12}
            make={() => ({
              id: uid(),
              kind: "custom",
              label: "made with",
              message: "love",
            })}
            render={(b, setB) => (
              <div className="space-y-1.5">
                <Select
                  value={b.kind}
                  onValueChange={(v) => setB({ kind: v as BadgeKind })}
                >
                  <SelectTrigger className="h-8 w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BADGES.map((x) => (
                      <SelectItem key={x.kind} value={x.kind}>
                        {x.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {b.kind === "custom" && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <Input
                      className={small}
                      placeholder="Label"
                      value={b.label ?? ""}
                      onChange={(e) => setB({ label: e.target.value })}
                    />
                    <Input
                      className={small}
                      placeholder="Message"
                      value={b.message ?? ""}
                      onChange={(e) => setB({ message: e.target.value })}
                    />
                  </div>
                )}
                {b.kind === "ci" && (
                  <Input
                    className={small}
                    placeholder="Workflow file, e.g. ci.yml"
                    value={b.message ?? ""}
                    onChange={(e) => setB({ message: e.target.value })}
                  />
                )}
                <div className="flex gap-1.5">
                  <Input
                    className={small}
                    placeholder="Logo (simple-icons name)"
                    value={b.logo ?? ""}
                    onChange={(e) => setB({ logo: e.target.value })}
                  />
                  <input
                    type="color"
                    aria-label="Badge colour"
                    value={`#${(b.color || project.accent).replace("#", "")}`}
                    onChange={(e) =>
                      setB({ color: e.target.value.replace("#", "") })
                    }
                    className="h-8 w-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
                  />
                </div>
              </div>
            )}
          />
        </div>
      );

    case "intro":
      return (
        <div className="space-y-3">
          <Field label="Pitch" hint="HTML and emoji work">
            <Textarea
              rows={3}
              value={block.text}
              onChange={(e) => set({ text: e.target.value })}
            />
          </Field>
          <Field label="Links">
            <List
              items={block.links}
              onChange={(links) => set({ links })}
              addLabel="Add link"
              max={6}
              make={() => ({ label: "Docs", url: "" })}
              render={(l, setL) => (
                <div className="grid grid-cols-[0.8fr_1.2fr] gap-1.5">
                  <Input
                    className={small}
                    placeholder="Label"
                    value={l.label}
                    onChange={(e) => setL({ label: e.target.value })}
                  />
                  <Input
                    className={small}
                    placeholder="https://"
                    value={l.url}
                    onChange={(e) => setL({ url: e.target.value })}
                  />
                </div>
              )}
            />
          </Field>
        </div>
      );

    case "toc":
      return (
        <div className="space-y-2">
          {heading}
          <p className="text-muted-foreground text-xs">
            Lists every section with a heading, and updates as you go.
          </p>
        </div>
      );

    case "features":
      return (
        <div className="space-y-3">
          {heading}
          <Segmented
            label="Columns"
            value={block.columns}
            options={
              [
                [2, "2 columns"],
                [3, "3 columns"],
              ] as const
            }
            onChange={(columns) => set({ columns })}
          />
          <List
            items={block.items}
            onChange={(items) => set({ items })}
            addLabel="Add feature"
            max={12}
            make={() => ({
              icon: "✦",
              title: "New feature",
              text: "What it does for people.",
            })}
            render={(f, setF) => (
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  <Input
                    className={cn(small, "w-11 shrink-0 px-0 text-center")}
                    aria-label="Icon"
                    value={f.icon}
                    onChange={(e) => setF({ icon: e.target.value })}
                  />
                  <Input
                    className={small}
                    placeholder="Title"
                    value={f.title}
                    onChange={(e) => setF({ title: e.target.value })}
                  />
                </div>
                <Textarea
                  rows={2}
                  className="min-h-0 text-sm"
                  value={f.text}
                  onChange={(e) => setF({ text: e.target.value })}
                />
              </div>
            )}
          />
        </div>
      );

    case "screenshots":
      return (
        <div className="space-y-3">
          {heading}
          <Segmented
            label="Layout"
            value={block.columns}
            options={
              [
                [1, "Stacked"],
                [2, "Side by side"],
              ] as const
            }
            onChange={(columns) => set({ columns })}
          />
          <List<Shot>
            items={block.images}
            onChange={(images) => set({ images })}
            addLabel="Add image"
            max={8}
            make={() => ({ src: "", alt: "Screenshot" })}
            render={(im, setIm) => (
              <div className="space-y-1.5">
                {im.file ? (
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={im.file}
                      alt=""
                      className="h-10 w-16 rounded border object-cover"
                    />
                    <span className="text-muted-foreground flex-1 text-xs">
                      Saved to assets/ on export
                    </span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground text-xs underline"
                      onClick={() => setIm({ file: undefined })}
                    >
                      Use a URL
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <Input
                      className={small}
                      placeholder="Image URL or GIF"
                      value={im.src}
                      onChange={(e) => setIm({ src: e.target.value })}
                    />
                    <label
                      className="hover:bg-muted grid h-8 w-9 shrink-0 cursor-pointer place-items-center rounded-md border"
                      title="Upload"
                    >
                      <ImagePlusIcon className="size-4" />
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) setIm({ file: await readImage(file) });
                        }}
                      />
                    </label>
                  </div>
                )}
                <Input
                  className={small}
                  placeholder="Alt text"
                  value={im.alt}
                  onChange={(e) => setIm({ alt: e.target.value })}
                />
              </div>
            )}
          />
        </div>
      );

    case "install":
      return (
        <div className="space-y-3">
          {heading}
          <Field label="Package name">
            <Input
              className={cn(small, "font-mono")}
              value={block.pkg}
              onChange={(e) => set({ pkg: e.target.value })}
            />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {(["npm", "pnpm", "yarn", "bun"] as const).map((m) => {
              const on = block.managers.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set({
                      managers: on
                        ? block.managers.filter((x) => x !== m)
                        : [...block.managers, m],
                    })
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 font-mono text-xs transition-colors",
                    on
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m}
                </button>
              );
            })}
          </div>
          <Toggle
            label="Dev dependency"
            checked={block.dev}
            onChange={(dev) => set({ dev })}
          />
          <Field label="Then run" hint="optional">
            <Textarea
              rows={3}
              className="font-mono text-xs"
              value={block.extra}
              onChange={(e) => set({ extra: e.target.value })}
            />
          </Field>
        </div>
      );

    case "usage":
      return (
        <div className="space-y-3">
          {heading}
          <Field label="Intro line" hint="optional">
            <Input
              className={small}
              value={block.note}
              onChange={(e) => set({ note: e.target.value })}
            />
          </Field>
          <Field label="Language">
            <Select value={block.lang} onValueChange={(lang) => set({ lang })}>
              <SelectTrigger className="h-8 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGS.map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Textarea
            rows={8}
            spellCheck={false}
            className="font-mono text-xs leading-relaxed"
            value={block.code}
            onChange={(e) => set({ code: e.target.value })}
          />
        </div>
      );

    case "api":
      return (
        <div className="space-y-3">
          {heading}
          <List
            items={block.rows}
            onChange={(rows) => set({ rows })}
            addLabel="Add row"
            max={30}
            make={() => ({
              name: "option",
              type: "string",
              def: "—",
              desc: "",
            })}
            render={(r, setR) => (
              <div className="space-y-1.5">
                <div className="grid grid-cols-3 gap-1.5">
                  <Input
                    className={cn(small, "font-mono text-xs")}
                    placeholder="name"
                    value={r.name}
                    onChange={(e) => setR({ name: e.target.value })}
                  />
                  <Input
                    className={cn(small, "font-mono text-xs")}
                    placeholder="type"
                    value={r.type}
                    onChange={(e) => setR({ type: e.target.value })}
                  />
                  <Input
                    className={cn(small, "font-mono text-xs")}
                    placeholder="default"
                    value={r.def}
                    onChange={(e) => setR({ def: e.target.value })}
                  />
                </div>
                <Input
                  className={small}
                  placeholder="Description"
                  value={r.desc}
                  onChange={(e) => setR({ desc: e.target.value })}
                />
              </div>
            )}
          />
        </div>
      );

    case "stack":
      return (
        <StackEditor block={block} heading={heading} set={set} dark={dark} />
      );

    case "alert":
      return (
        <div className="space-y-3">
          <Segmented
            label="Kind"
            value={block.kind}
            options={
              [
                ["NOTE", "Note"],
                ["TIP", "Tip"],
                ["IMPORTANT", "Important"],
                ["WARNING", "Warning"],
                ["CAUTION", "Caution"],
              ] as const
            }
            onChange={(kind) => set({ kind })}
          />
          <Textarea
            rows={3}
            value={block.text}
            onChange={(e) => set({ text: e.target.value })}
          />
        </div>
      );

    case "roadmap":
      return (
        <div className="space-y-3">
          {heading}
          <List
            items={block.items}
            onChange={(items) => set({ items })}
            addLabel="Add milestone"
            make={() => ({ text: "Next milestone", done: false })}
            render={(r, setR) => (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label="Done"
                  checked={r.done}
                  onChange={(e) => setR({ done: e.target.checked })}
                  className="accent-primary size-4"
                />
                <Input
                  className={small}
                  value={r.text}
                  onChange={(e) => setR({ text: e.target.value })}
                />
              </div>
            )}
          />
        </div>
      );

    case "faq":
      return (
        <div className="space-y-3">
          {heading}
          <List
            items={block.items}
            onChange={(items) => set({ items })}
            addLabel="Add question"
            make={() => ({ q: "A question people ask?", a: "The answer." })}
            render={(f, setF) => (
              <div className="space-y-1.5">
                <Input
                  className={cn(small, "font-medium")}
                  value={f.q}
                  onChange={(e) => setF({ q: e.target.value })}
                />
                <Textarea
                  rows={2}
                  className="min-h-0 text-sm"
                  value={f.a}
                  onChange={(e) => setF({ a: e.target.value })}
                />
              </div>
            )}
          />
        </div>
      );

    case "contributing":
      return (
        <div className="space-y-3">
          {heading}
          <Textarea
            rows={4}
            value={block.text}
            onChange={(e) => set({ text: e.target.value })}
          />
          <Toggle
            label="Contributors wall"
            checked={block.contributors}
            onChange={(contributors) => set({ contributors })}
          />
          <Toggle
            label="Star history chart"
            checked={block.starHistory}
            onChange={(starHistory) => set({ starHistory })}
          />
        </div>
      );

    case "license":
      return (
        <div className="space-y-3">
          {heading}
          <div className="grid grid-cols-2 gap-2">
            <Field label="License">
              <Select
                value={block.license}
                onValueChange={(license) => set({ license })}
              >
                <SelectTrigger className="h-8 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set([block.license, ...LICENSES])].map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Copyright holder">
              <Input
                className={small}
                value={block.holder}
                onChange={(e) => set({ holder: e.target.value })}
              />
            </Field>
          </div>
        </div>
      );

    case "profile":
      return (
        <div className="space-y-3">
          {heading}
          <Field label="GitHub username">
            <Input
              className={small}
              value={block.username}
              onChange={(e) => set({ username: e.target.value })}
            />
          </Field>
          <Toggle
            label="Stats card"
            checked={block.stats}
            onChange={(stats) => set({ stats })}
          />
          <Toggle
            label="Top languages"
            checked={block.langs}
            onChange={(langs) => set({ langs })}
          />
          <Toggle
            label="Contribution streak"
            checked={block.streak}
            onChange={(streak) => set({ streak })}
          />
        </div>
      );

    case "custom":
      return (
        <Field label="Markdown" hint="anything GitHub renders">
          <Textarea
            rows={8}
            spellCheck={false}
            className="font-mono text-xs leading-relaxed"
            value={block.markdown}
            onChange={(e) => set({ markdown: e.target.value })}
          />
        </Field>
      );

    case "footer":
      return (
        <div className="space-y-3">
          <Field label="Sign-off" hint="HTML works">
            <Input
              className={small}
              value={block.text}
              onChange={(e) => set({ text: e.target.value })}
            />
          </Field>
          <Toggle
            label="Wave artwork"
            checked={block.wave}
            onChange={(wave) => set({ wave })}
          />
          <Toggle
            label="Back to top link"
            checked={block.backToTop}
            onChange={(backToTop) => set({ backToTop })}
          />
        </div>
      );
  }
}

function BannerThumb({
  url,
  label,
  active,
  dark,
  onClick,
}: {
  url: string;
  label: string;
  active: boolean;
  dark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group/t overflow-hidden rounded-lg border text-left transition-colors",
        active
          ? "border-primary ring-primary/25 ring-2"
          : "hover:border-foreground/25",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className={cn("block aspect-[1280/400] w-full object-contain", dark ? "bg-[#0d1117]" : "bg-white")}
      />
      <span
        className={cn(
          "block px-2 py-1 text-[11px]",
          active ? "text-primary font-medium" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </button>
  );
}

function StackEditor({
  block,
  heading,
  set,
  dark,
}: {
  block: Extract<Block, { type: "stack" }>;
  heading: React.ReactNode;
  set: (patch: Partial<Block>) => void;
  dark: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const pool = SKILL_ICONS.filter(
    (i) => !block.icons.includes(i) && i.includes(query.trim().toLowerCase()),
  );
  const icon = (id: string) =>
    `https://skillicons.dev/icons?i=${id}&theme=${dark ? "dark" : "light"}`;
  return (
    <div className="space-y-3">
      {heading}
      <div className="flex flex-wrap gap-1.5">
        {block.icons.map((id) => (
          <button
            key={id}
            type="button"
            title={`Remove ${id}`}
            onClick={() => set({ icons: block.icons.filter((x) => x !== id) })}
            className="group/i relative"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={icon(id)}
              alt={id}
              className="size-8 rounded-md"
              loading="lazy"
            />
            <span className="bg-background/80 absolute inset-0 hidden place-items-center rounded-md group-hover/i:grid">
              <XIcon className="size-3.5" />
            </span>
          </button>
        ))}
      </div>
      <Input
        className={small}
        placeholder="Find a logo: docker, rust, figma…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
        {pool.map((id) => (
          <button
            key={id}
            type="button"
            title={id}
            onClick={() => set({ icons: [...block.icons, id] })}
            className="opacity-60 transition-opacity hover:opacity-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={icon(id)}
              alt={id}
              className="size-6 rounded"
              loading="lazy"
            />
          </button>
        ))}
        {!pool.length && query && (
          <button
            type="button"
            className="text-primary text-xs underline"
            onClick={() =>
              set({ icons: [...block.icons, query.trim().toLowerCase()] })
            }
          >
            Add “{query.trim()}”
          </button>
        )}
      </div>
      <Field label="Per row">
        <Segmented
          label="Per row"
          value={block.perline}
          options={
            [
              [6, "6"],
              [8, "8"],
              [10, "10"],
              [12, "12"],
              [15, "15"],
            ] as const
          }
          onChange={(perline) => set({ perline })}
        />
      </Field>
    </div>
  );
}
