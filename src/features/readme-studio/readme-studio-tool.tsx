"use client";

import * as React from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  CopyPlusIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  FileArchiveIcon,
  GripVerticalIcon,
  LoaderCircleIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SmartphoneIcon,
  SunIcon,
  Trash2Icon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TOOL_BY_ID } from "@/constants/tools";
import { embeddedFontCss, linkAllFonts, type FontId } from "@/lib/poster/fonts";
import { BANNER_STYLES } from "@/lib/readme/banners";
import { generate, health } from "@/lib/readme/generate";
import { importRepo } from "@/lib/readme/github";
import {
  TEMPLATES,
  fromTemplate,
  newBlock,
  starterProject,
  type TemplateId,
} from "@/lib/readme/templates";
import {
  BLOCK_INFO,
  uid,
  type Block,
  type BlockType,
  type Project,
} from "@/lib/readme/types";
import { buildZip } from "@/lib/zip";
import { cn } from "@/lib/utils";
import { BlockEditor, Field, Segmented } from "./block-editor";
import { GithubPreview } from "./github-preview";

/* ------------------------------------------------------------------ state */

const STORE = "readme-studio:v1";
const subscribeNever = () => () => {};

function load(): Project | null {
  try {
    const raw = window.localStorage.getItem(STORE);
    if (!raw) return null;
    const p = JSON.parse(raw) as Project;
    return Array.isArray(p.blocks) && typeof p.name === "string" ? p : null;
  } catch {
    return null;
  }
}

function save(p: Project) {
  try {
    window.localStorage.setItem(STORE, JSON.stringify(p));
  } catch {
    // Too big to keep (large screenshots) or storage blocked: try without uploads.
    try {
      const lean = {
        ...p,
        blocks: p.blocks.map((b) =>
          b.type === "screenshots"
            ? {
                ...b,
                images: b.images.map(({ file, ...im }) =>
                  file ? { ...im, src: "" } : im,
                ),
              }
            : b,
        ),
      };
      window.localStorage.setItem(STORE, JSON.stringify(lean));
    } catch {
      // Nothing more to do; the work just isn't kept between visits.
    }
  }
}

/** Where a new section of each type usually sits in a README. */
const ORDER: BlockType[] = [
  "banner",
  "badges",
  "intro",
  "alert",
  "toc",
  "screenshots",
  "features",
  "install",
  "usage",
  "api",
  "stack",
  "profile",
  "roadmap",
  "faq",
  "custom",
  "contributing",
  "license",
  "footer",
];

function insertAt(blocks: Block[], type: BlockType) {
  const rank = ORDER.indexOf(type);
  const i = blocks.findIndex((b) => ORDER.indexOf(b.type) > rank);
  return i === -1 ? blocks.length : i;
}

const ACCENTS = [
  "#10b981",
  "#6366f1",
  "#f43f5e",
  "#f59e0b",
  "#0ea5e9",
  "#8b5cf6",
  "#f97316",
  "#71717a",
];

function summary(b: Block): string {
  switch (b.type) {
    case "banner":
      return BANNER_STYLES.find((s) => s.id === b.style)?.label ?? "";
    case "badges":
      return `${b.items.length} badges`;
    case "features":
      return `${b.items.length} items`;
    case "screenshots":
      return `${b.images.filter((i) => i.src || i.file).length} images`;
    case "install":
      return b.pkg;
    case "usage":
      return b.lang;
    case "api":
      return `${b.rows.length} rows`;
    case "stack":
      return `${b.icons.length} logos`;
    case "alert":
      return b.kind.toLowerCase();
    case "roadmap":
      return `${b.items.filter((i) => i.done).length}/${b.items.length} done`;
    case "faq":
      return `${b.items.length} questions`;
    case "license":
      return b.license;
    default:
      return b.title && b.title !== BLOCK_INFO[b.type].heading ? b.title : "";
  }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function dataUrlBytes(url: string) {
  const bin = atob(url.slice(url.indexOf(",") + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ------------------------------------------------------------------- tool */

export function ReadmeStudioTool() {
  const [project, setProject] = React.useState<Project>(starterProject);
  const [open, setOpen] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"preview" | "markdown">("preview");
  const [narrow, setNarrow] = React.useState(false);
  const { resolvedTheme } = useTheme();
  const [themeChoice, setThemeChoice] = React.useState<"light" | "dark" | null>(
    null,
  );
  const [fontCss, setFontCss] = React.useState<Record<string, string>>({});
  const [repoInput, setRepoInput] = React.useState("");
  const [importing, setImporting] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const rows = React.useRef<Record<string, HTMLLIElement | null>>({});

  // Restore saved work once the browser is available.
  const hydrated = React.useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const theme =
    themeChoice ?? (hydrated && resolvedTheme === "dark" ? "dark" : "light");
  const [restored, setRestored] = React.useState(false);
  if (hydrated && !restored) {
    setRestored(true);
    const saved = load();
    if (saved) setProject(saved);
  }
  React.useEffect(() => {
    if (!restored) return;
    const t = window.setTimeout(() => save(project), 500);
    return () => window.clearTimeout(t);
  }, [project, restored]);

  React.useEffect(() => linkAllFonts(), []);

  // Banner fonts are embedded into the SVG files, so they render on GitHub.
  const bannerFonts = React.useMemo(
    () =>
      [
        ...new Set(
          project.blocks.flatMap((b) => (b.type === "banner" ? [b.font] : [])),
        ),
      ].filter((f) => f !== "system" && f !== "custom"),
    [project.blocks],
  );
  React.useEffect(() => {
    for (const id of bannerFonts) {
      if (fontCss[id] !== undefined) continue;
      embeddedFontCss([id as FontId]).then(
        (css) => setFontCss((m) => ({ ...m, [id]: css })),
        () => setFontCss((m) => ({ ...m, [id]: "" })),
      );
    }
  }, [bannerFonts, fontCss]);

  const deferred = React.useDeferredValue(project);
  const preview = React.useMemo(
    () => generate(deferred, { fontCss, markers: true }),
    [deferred, fontCss],
  );
  const exported = React.useMemo(
    () => generate(deferred, { fontCss }),
    [deferred, fontCss],
  );
  const report = React.useMemo(() => health(project), [project]);

  /* ---------------------------------------------------------- editing */

  const setP = <K extends keyof Project>(key: K, value: Project[K]) =>
    setProject((p) => ({ ...p, [key]: value }));
  const setBlock = (b: Block) =>
    setProject((p) => ({
      ...p,
      blocks: p.blocks.map((x) => (x.id === b.id ? b : x)),
    }));
  const withUndo = (message: string, before: Project) =>
    toast(message, {
      action: { label: "Undo", onClick: () => setProject(before) },
    });

  const addBlock = (type: BlockType) => {
    const b = newBlock(type, project);
    setProject((p) => {
      const blocks = [...p.blocks];
      blocks.splice(insertAt(blocks, type), 0, b);
      return { ...p, blocks };
    });
    setOpen(b.id);
    setAdding(false);
    window.setTimeout(
      () =>
        rows.current[b.id]?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        }),
      60,
    );
  };

  const removeBlock = (id: string) => {
    const before = project;
    setProject((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== id) }));
    withUndo(
      `${BLOCK_INFO[before.blocks.find((b) => b.id === id)!.type].label} removed`,
      before,
    );
  };

  const duplicate = (id: string) =>
    setProject((p) => {
      const i = p.blocks.findIndex((b) => b.id === id);
      const copy = { ...structuredClone(p.blocks[i]), id: uid() };
      const blocks = [...p.blocks];
      blocks.splice(i + 1, 0, copy);
      return { ...p, blocks };
    });

  const move = (from: string, to: string) =>
    setProject((p) => {
      const blocks = [...p.blocks];
      const a = blocks.findIndex((b) => b.id === from);
      const b = blocks.findIndex((x) => x.id === to);
      if (a < 0 || b < 0 || a === b) return p;
      const [x] = blocks.splice(a, 1);
      blocks.splice(b, 0, x);
      return { ...p, blocks };
    });

  const applyTemplate = (id: TemplateId) => {
    const before = project;
    setProject((p) => ({ ...p, blocks: fromTemplate(id, p) }));
    setOpen(null);
    withUndo(
      `${TEMPLATES.find((t) => t.id === id)!.label} template applied`,
      before,
    );
  };

  const runImport = async () => {
    if (!repoInput.trim() || importing) return;
    setImporting(true);
    const before = project;
    try {
      const next = await importRepo(repoInput, project.accent, project);
      setProject(next);
      setOpen(null);
      withUndo(`Drafted from ${next.owner}/${next.repo}`, before);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Couldn't read that repository.",
      );
    } finally {
      setImporting(false);
    }
  };

  const pick = (id: string) => {
    setOpen(id);
    window.setTimeout(
      () =>
        rows.current[id]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        }),
      60,
    );
  };

  /* ---------------------------------------------------------- export */

  // Exports wait for banner fonts, so the files never ship with a fallback face.
  const finalOutput = async () => {
    const missing = bannerFonts.filter((f) => !fontCss[f]);
    if (!missing.length) return exported;
    const css = { ...fontCss };
    await Promise.all(
      missing.map(
        async (f) =>
          (css[f] = await embeddedFontCss([f as FontId]).catch(() => "")),
      ),
    );
    return generate(project, { fontCss: css });
  };

  const copy = async () => {
    const out = await finalOutput();
    try {
      await navigator.clipboard.writeText(out.markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      if (Object.keys(out.assets).length)
        toast("Markdown copied", {
          description:
            "It points to ./assets. Download the ZIP for the banner files.",
        });
    } catch {
      toast.error("Clipboard is blocked here. Use Download instead.");
    }
  };

  const downloadMd = async () => {
    const out = await finalOutput();
    download(new Blob([out.markdown], { type: "text/markdown" }), "README.md");
  };

  const downloadZip = async () => {
    const out = await finalOutput();
    const enc = new TextEncoder();
    const entries = [
      { name: "README.md", data: enc.encode(out.markdown) },
      ...Object.entries(out.assets).map(([name, content]) => ({
        name,
        data: content.startsWith("data:")
          ? dataUrlBytes(content)
          : enc.encode(content),
      })),
    ];
    download(buildZip(entries), `${project.repo || "readme"}-readme.zip`);
    toast("ZIP downloaded", {
      description: "Unzip it into the root of your repo and push.",
    });
  };

  /* ------------------------------------------------------------ view */

  const ring = 2 * Math.PI * 15;
  const missing = report.checks.filter((c) => !c.ok);

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.readme}
      wideOutput
      output={
        <div className="space-y-3 lg:sticky lg:top-20">
          <Card className="py-0">
            <CardContent className="flex flex-wrap items-center gap-2 p-2.5">
              <div className="w-44">
                <Segmented
                  label="View"
                  value={mode}
                  options={
                    [
                      ["preview", "Preview"],
                      ["markdown", "Markdown"],
                    ] as const
                  }
                  onChange={setMode}
                />
              </div>
              <div className="bg-muted/60 flex gap-0.5 rounded-lg p-0.5">
                <IconToggle
                  label="Light"
                  active={theme === "light"}
                  onClick={() => setThemeChoice("light")}
                >
                  <SunIcon />
                </IconToggle>
                <IconToggle
                  label="Dark"
                  active={theme === "dark"}
                  onClick={() => setThemeChoice("dark")}
                >
                  <MoonIcon />
                </IconToggle>
              </div>
              <div className="bg-muted/60 flex gap-0.5 rounded-lg p-0.5">
                <IconToggle
                  label="Desktop width"
                  active={!narrow}
                  onClick={() => setNarrow(false)}
                >
                  <MonitorIcon />
                </IconToggle>
                <IconToggle
                  label="Phone width"
                  active={narrow}
                  onClick={() => setNarrow(true)}
                >
                  <SmartphoneIcon />
                </IconToggle>
              </div>
              <span className="flex-1" />
              <Button size="sm" variant="ghost" onClick={downloadMd}>
                <DownloadIcon /> .md
              </Button>
              <Button size="sm" variant="outline" onClick={downloadZip}>
                <FileArchiveIcon /> ZIP
              </Button>
              <Button size="sm" onClick={copy}>
                {copied ? <CheckIcon /> : <CopyIcon />}{" "}
                {copied ? "Copied" : "Copy markdown"}
              </Button>
            </CardContent>
          </Card>

          <div className="bg-muted/40 max-h-[calc(100vh-11rem)] overflow-y-auto rounded-xl lg:min-h-[60vh]">
            <div
              className={cn(
                "mx-auto transition-[max-width] duration-300",
                narrow ? "max-w-[400px] py-4" : "max-w-none",
              )}
            >
              {!hydrated ? (
                <div className="bg-muted h-[60vh] animate-pulse rounded-xl" />
              ) : (
                <GithubPreview
                  project={deferred}
                  markdown={preview.markdown}
                  assets={preview.assets}
                  source={exported.markdown}
                  theme={theme}
                  narrow={narrow}
                  mode={mode}
                  active={open}
                  onPick={pick}
                />
              )}
            </div>
          </div>
          <p className="text-muted-foreground px-1 text-xs">
            Click any part of the preview to edit it. Banners and artwork go in
            an assets folder in the ZIP.
          </p>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Start */}
        <Card className="py-0">
          <CardContent className="space-y-4 p-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Start from a repo</p>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  runImport();
                }}
              >
                <div className="relative flex-1">
                  <GithubIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                  <Input
                    className="h-9 pl-8 text-sm"
                    placeholder="owner/repo or URL"
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="h-9"
                  disabled={importing || !repoInput.trim()}
                >
                  {importing ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : (
                    "Draft"
                  )}
                </Button>
              </form>
              <p className="text-muted-foreground text-xs">
                Reads its description, package.json, license and CI to pick the
                right sections.
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Or a template</p>
              <div className="grid grid-cols-5 gap-1">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    title={t.note}
                    onClick={() => applyTemplate(t.id)}
                    className="hover:border-primary/40 hover:bg-primary/5 rounded-lg border px-1 py-2 text-center text-[11px] leading-tight font-medium transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project */}
        <Card className="py-0">
          <CardContent className="space-y-3 p-4">
            <Field label="Project name">
              <Input
                className="h-9"
                value={project.name}
                onChange={(e) => setP("name", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Owner">
                <Input
                  className="h-8 text-sm"
                  value={project.owner}
                  onChange={(e) => setP("owner", e.target.value)}
                />
              </Field>
              <Field label="Repo">
                <Input
                  className="h-8 text-sm"
                  value={project.repo}
                  onChange={(e) => setP("repo", e.target.value)}
                />
              </Field>
            </div>
            <Field label="One-line description">
              <Textarea
                rows={2}
                className="min-h-0 text-sm"
                value={project.description}
                onChange={(e) => setP("description", e.target.value)}
              />
            </Field>
            <Field label="Accent">
              <div className="flex items-center gap-1.5">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Accent ${c}`}
                    onClick={() => setP("accent", c)}
                    className={cn(
                      "size-6 rounded-full transition-transform hover:scale-110",
                      project.accent === c &&
                        "ring-foreground/70 ring-2 ring-offset-2 ring-offset-[var(--card)]",
                    )}
                    style={{ background: c }}
                  />
                ))}
                <label
                  className="relative ml-auto size-6 cursor-pointer overflow-hidden rounded-full border"
                  title="Custom colour"
                >
                  <span
                    className="absolute inset-0"
                    style={{
                      background:
                        "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
                    }}
                  />
                  <input
                    type="color"
                    value={project.accent}
                    onChange={(e) => setP("accent", e.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </Field>
            <div className="divide-border divide-y">
              <SwitchRow
                label="Animated artwork"
                checked={project.animated}
                onChange={(v) => setP("animated", v)}
              />
              <SwitchRow
                label="Section dividers"
                checked={project.dividers}
                onChange={(v) => setP("dividers", v)}
              />
              <SwitchRow
                label="Emoji in headings"
                checked={project.emoji}
                onChange={(v) => setP("emoji", v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Sections */}
        <Card className="py-0">
          <CardContent className="p-2">
            <div className="flex items-center justify-between px-2 pt-1.5 pb-2">
              <p className="text-sm font-medium">Sections</p>
              <span className="text-muted-foreground text-xs">
                Drag to reorder
              </span>
            </div>
            <ul className="space-y-1">
              {project.blocks.map((b) => {
                const isOpen = open === b.id;
                const info = BLOCK_INFO[b.type];
                const sub = summary(b);
                return (
                  <li
                    key={b.id}
                    ref={(el) => {
                      rows.current[b.id] = el;
                    }}
                    onDragOver={(e) => {
                      if (!dragId || dragId === b.id) return;
                      e.preventDefault();
                      move(dragId, b.id);
                    }}
                    className={cn(
                      "rounded-lg border transition-colors",
                      isOpen
                        ? "border-primary/40 bg-primary/[0.03]"
                        : "border-transparent hover:bg-muted/50",
                      dragId === b.id && "opacity-50",
                      b.hidden && "opacity-55",
                    )}
                  >
                    <div
                      draggable
                      onDragStart={(e) => {
                        setDragId(b.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDragId(null)}
                      className="flex items-center gap-1 py-1 pr-1 pl-1"
                    >
                      <GripVerticalIcon
                        className="text-muted-foreground/50 size-4 shrink-0 cursor-grab"
                        aria-hidden
                      />
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : b.id)}
                        aria-expanded={isOpen}
                        className="flex min-w-0 flex-1 items-baseline gap-2 py-1 text-left"
                      >
                        <span
                          className={cn(
                            "truncate text-sm",
                            isOpen && "font-medium",
                          )}
                        >
                          {b.type === "custom" || b.type === "alert"
                            ? info.label
                            : b.title || info.label}
                        </span>
                        {sub && (
                          <span className="text-muted-foreground truncate font-mono text-[11px]">
                            {sub}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={b.hidden ? "Show section" : "Hide section"}
                        onClick={() => setBlock({ ...b, hidden: !b.hidden })}
                        className="text-muted-foreground hover:text-foreground grid size-7 place-items-center rounded-md"
                      >
                        {b.hidden ? (
                          <EyeOffIcon className="size-3.5" />
                        ) : (
                          <EyeIcon className="size-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={isOpen ? "Collapse" : "Edit"}
                        onClick={() => setOpen(isOpen ? null : b.id)}
                        className="text-muted-foreground hover:text-foreground grid size-7 place-items-center rounded-md"
                      >
                        <ChevronDownIcon
                          className={cn(
                            "size-4 transition-transform",
                            isOpen && "rotate-180",
                          )}
                        />
                      </button>
                    </div>
                    {isOpen && (
                      <div className="space-y-3 px-3 pt-1 pb-3">
                        <BlockEditor
                          block={b}
                          project={project}
                          dark={theme === "dark"}
                          onChange={setBlock}
                        />
                        <div className="flex justify-end gap-1 border-t pt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground h-7 text-xs"
                            onClick={() => duplicate(b.id)}
                          >
                            <CopyPlusIcon /> Duplicate
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive h-7 text-xs"
                            onClick={() => removeBlock(b.id)}
                          >
                            <Trash2Icon /> Remove
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {adding ? (
              <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-dashed p-1.5">
                {(Object.keys(BLOCK_INFO) as BlockType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => addBlock(t)}
                    className="hover:bg-muted rounded-md px-2 py-1.5 text-left"
                  >
                    <span className="block text-xs font-medium">
                      {BLOCK_INFO[t].label}
                    </span>
                    <span className="text-muted-foreground block truncate text-[11px]">
                      {BLOCK_INFO[t].hint}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="text-muted-foreground hover:text-foreground col-span-2 py-1 text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="text-muted-foreground hover:text-foreground hover:border-primary/40 mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2.5 text-sm transition-colors"
              >
                <PlusIcon className="size-4" /> Add section
              </button>
            )}
          </CardContent>
        </Card>

        {/* Health */}
        <Card className="py-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <svg
                viewBox="0 0 36 36"
                className="size-12 -rotate-90"
                aria-hidden
              >
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  strokeWidth="3"
                  className="stroke-muted"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="stroke-primary transition-[stroke-dashoffset] duration-500"
                  strokeDasharray={ring}
                  strokeDashoffset={ring * (1 - report.score / 100)}
                />
              </svg>
              <div>
                <p className="text-sm font-medium">
                  README health{" "}
                  <span className="text-primary font-mono">{report.score}</span>
                </p>
                <p className="text-muted-foreground text-xs">
                  {missing.length
                    ? "What readers look for and don't find yet"
                    : "Everything a reader looks for is here."}
                </p>
              </div>
            </div>
            {missing.length > 0 && (
              <ul className="mt-3 space-y-1">
                {missing.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-muted-foreground">{c.label}</span>
                    {c.fix && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => addBlock(c.fix!)}
                      >
                        <PlusIcon /> Add
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  );
}

function IconToggle({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-7 place-items-center rounded-md transition-colors [&>svg]:size-3.5",
        active
          ? "bg-background shadow-xs"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between py-2 text-sm">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
