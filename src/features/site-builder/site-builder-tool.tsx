"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon, DownloadIcon, ExternalLinkIcon, HistoryIcon, KeyboardIcon, LayersIcon,
  LayoutTemplateIcon, ListChecksIcon, MonitorIcon, MoreHorizontalIcon, PaletteIcon, PencilIcon,
  PlusIcon, RocketIcon, SlidersHorizontalIcon, SmartphoneIcon, TabletIcon, Trash2Icon, Undo2Icon,
  Redo2Icon, UploadIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  checkSummary, defOf, duplicateBlock, makeBlock, rows, runChecks, sectionAnchors, str,
  MAX_BLOCKS, type Block, type BlockType, type CheckResult, type PropValue, type Site, type Theme,
} from "@/lib/site-builder";
import { buildSite } from "@/lib/site-builder-render";
import { blankSite } from "@/lib/site-builder-templates";
import { Canvas, type Device } from "./canvas";
import { ChecksPanel } from "./checks-panel";
import { DesignPanel } from "./design-panel";
import { ExportDialog } from "./export-dialog";
import { Inspector } from "./inspector";
import { Outline } from "./outline";
import { SectionPicker } from "./section-picker";
import { StartDialog } from "./start-dialog";
import { useSiteLibrary } from "./use-site-library";

type Panel = "section" | "design" | "page";
type Pane = "sections" | "preview" | "edit";

export function SiteBuilderTool() {
  const library = useSiteLibrary(blankSite);
  const { site } = library;

  const [picked, setSelected] = useState("");
  const [focusField, setFocusField] = useState("");
  const [panel, setPanel] = useState<Panel>("section");
  const [pane, setPane] = useState<Pane>("preview");
  const [device, setDevice] = useState<Device>("desktop");
  const [inline, setInline] = useState(true);
  const [scrollTo, setScrollTo] = useState<{ id: string; at: number } | null>(null);
  const [startState, setStartOpen] = useState<boolean | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [checksOpen, setChecksOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [versionName, setVersionName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  // Both derived rather than stored: the selection follows the blocks that
  // actually exist, and the first visit opens the start dialog on its own.
  const selected = picked && site.blocks.some((entry) => entry.id === picked) ? picked : site.blocks[0]?.id ?? "";
  const startOpen = startState ?? (library.ready && library.fresh);

  const checks = useMemo(() => runChecks(site), [site]);
  const summary = checkSummary(checks);
  const block = site.blocks.find((entry) => entry.id === selected) ?? null;

  const anchors = useMemo(() => {
    const map = sectionAnchors(site.blocks.filter((entry) => !entry.hidden));
    return site.blocks
      .filter((entry) => !entry.hidden && map.has(entry.id))
      .map((entry) => ({
        value: `#${map.get(entry.id)}`,
        label: `${defOf(entry.type).name}${str(entry, "heading") ? `: ${str(entry, "heading").slice(0, 24)}` : ""}`,
      }));
  }, [site.blocks]);

  const anchorOf = useCallback(
    (id: string) => sectionAnchors(site.blocks.filter((entry) => !entry.hidden)).get(id) ?? "",
    [site.blocks],
  );

  /* ------------------------------------------------------------ mutations */

  const writeBlocks = useCallback(
    (map: (blocks: Block[]) => Block[], tag?: string) => library.update((current) => ({ blocks: map(current.blocks) }), { tag }),
    [library],
  );

  const setProps = useCallback(
    (id: string, patch: Record<string, PropValue>, tag?: string) =>
      writeBlocks((blocks) => blocks.map((entry) => (entry.id === id ? { ...entry, props: { ...entry.props, ...patch } } : entry)), tag),
    [writeBlocks],
  );

  const addBlock = useCallback((type: BlockType) => {
    if (site.blocks.length >= MAX_BLOCKS) {
      toast.error(`A page holds up to ${MAX_BLOCKS} sections. That is already a lot of scrolling.`);
      return;
    }
    const fresh = makeBlock(type);
    const def = defOf(type);
    writeBlocks((blocks) => {
      const next = [...blocks];
      // Headers belong at the top and footers at the bottom; everything else
      // lands right after whatever section you were looking at.
      if (def.group === "Header") {
        next.unshift(fresh);
        return next;
      }
      if (type === "footer") {
        next.push(fresh);
        return next;
      }
      const footerAt = next.findIndex((entry) => entry.type === "footer");
      const current = next.findIndex((entry) => entry.id === selected);
      const limit = footerAt >= 0 ? footerAt : next.length;
      next.splice(current >= 0 ? Math.min(current + 1, limit) : limit, 0, fresh);
      return next;
    });
    setSelected(fresh.id);
    setPanel("section");
    setPane("edit");
    setScrollTo({ id: fresh.id, at: Date.now() });
    toast.success(`${def.name} added`);
  }, [site.blocks.length, selected, writeBlocks]);

  const removeBlock = useCallback((id: string) => {
    const target = site.blocks.find((entry) => entry.id === id);
    if (!target) return;
    writeBlocks((blocks) => blocks.filter((entry) => entry.id !== id));
    if (selected === id) setSelected("");
    toast.success(`${defOf(target.type).name} removed`, {
      action: {
        label: "Undo",
        onClick: () => library.undo(),
      },
    });
  }, [site.blocks, selected, writeBlocks, library]);

  const copyBlock = useCallback((id: string) => {
    const source = site.blocks.find((entry) => entry.id === id);
    if (!source) return;
    const copy = duplicateBlock(source);
    writeBlocks((blocks) => {
      const at = blocks.findIndex((entry) => entry.id === id);
      const next = [...blocks];
      next.splice(at + 1, 0, copy);
      return next;
    });
    setSelected(copy.id);
  }, [site.blocks, writeBlocks]);

  const reorder = useCallback((from: number, to: number) => {
    writeBlocks((blocks) => {
      const next = [...blocks];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, [writeBlocks]);

  const applyInline = useCallback((id: string, path: string, value: string) => {
    const [field, indexRaw, key] = path.split(".");
    writeBlocks(
      (blocks) => blocks.map((entry) => {
        if (entry.id !== id) return entry;
        if (indexRaw === undefined) return { ...entry, props: { ...entry.props, [field]: value } };
        const index = Number(indexRaw);
        const list = rows(entry, field).map((row, i) => (i === index ? { ...row, [key]: value } : row));
        return { ...entry, props: { ...entry.props, [field]: list } };
      }),
      `inline-${id}-${path}`,
    );
  }, [writeBlocks]);

  const setTheme = useCallback(
    (patch: Partial<Theme>, tag?: string) => library.update((current) => ({ theme: { ...current.theme, ...patch } }), { tag }),
    [library],
  );

  const jump = useCallback((result: CheckResult) => {
    setChecksOpen(false);
    if (result.target === "meta") {
      setPanel("page");
      setPane("edit");
      return;
    }
    if (result.target === "theme") {
      setPanel("design");
      setPane("edit");
      return;
    }
    if (result.blockId) {
      setSelected(result.blockId);
      setPanel("section");
      setScrollTo({ id: result.blockId, at: Date.now() });
    }
  }, []);

  const openPreviewTab = useCallback(() => {
    const url = URL.createObjectURL(new Blob([buildSite(site).html], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, [site]);

  /* ----------------------------------------------------------- shortcuts */

  const shortcut = useCallback((key: string, shift: boolean) => {
    if (key === "z") (shift ? library.redo : library.undo)();
    if (key === "y") library.redo();
    if (key === "s") setExportOpen(true);
  }, [library]);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (!["z", "y", "s"].includes(key)) return;
      event.preventDefault();
      shortcut(key, event.shiftKey);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [shortcut]);

  /* --------------------------------------------------------------- views */

  // Sites carry generated ids, so the server and the first client render would
  // disagree about every field id. Waiting for the stored library settles it and
  // doubles as the loading state.
  if (!library.ready) return <Skeleton />;

  const deviceButtons: { id: Device; label: string; icon: typeof MonitorIcon }[] = [
    { id: "desktop", label: "Desktop", icon: MonitorIcon },
    { id: "tablet", label: "Tablet", icon: TabletIcon },
    { id: "phone", label: "Phone", icon: SmartphoneIcon },
  ];

  return (
    <div className="bg-background flex h-full min-h-0 flex-col">
      {/* ------------------------------------------------------------ top bar */}
      <header className="border-border/80 flex h-14 shrink-0 items-center gap-2 border-b px-2 sm:px-4">
        <Link href="/tools" aria-label="Back to tools" className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-2">
          <ArrowLeftIcon className="size-4" />
        </Link>
        <div className="bg-primary/10 text-primary hidden size-8 shrink-0 place-items-center rounded-lg sm:grid">
          <LayoutTemplateIcon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <Input
            aria-label="Site name"
            value={site.name}
            onChange={(event) => library.update({ name: event.target.value }, { tag: "name" })}
            className="h-7 border-0 bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:ring-0 md:text-[15px]"
          />
          <p role="status" className="text-muted-foreground truncate px-1 text-[10px] leading-3">{library.status}</p>
        </div>

        <div className="bg-muted/60 hidden gap-0.5 rounded-lg p-0.5 md:flex">
          {deviceButtons.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setDevice(entry.id)}
              aria-label={entry.label}
              aria-pressed={device === entry.id}
              className={cn(
                "rounded-md px-2 py-1.5 transition-colors",
                device === entry.id ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <entry.icon className="size-4" />
            </button>
          ))}
        </div>

        <div className="hidden sm:flex">
          <Button variant="ghost" size="icon-sm" aria-label="Undo" disabled={!library.canUndo} onClick={library.undo}>
            <Undo2Icon />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Redo" disabled={!library.canRedo} onClick={library.redo}>
            <Redo2Icon />
          </Button>
        </div>

        <Button
          variant={summary.errors ? "outline" : "ghost"}
          size="sm"
          onClick={() => setChecksOpen(true)}
          className={cn("hidden sm:inline-flex", summary.errors && "border-red-500/40 text-red-600 dark:text-red-400")}
        >
          <ListChecksIcon />
          <span className="hidden lg:inline">Checks</span>
          {checks.length > 0 && <span className="bg-muted rounded-full px-1.5 text-[10px] tabular-nums">{checks.length}</span>}
        </Button>

        <Button size="sm" onClick={() => setExportOpen(true)}>
          <RocketIcon />
          <span className="hidden sm:inline">Export</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => setStartOpen(true)}>
              <PlusIcon />
              New site from a template
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => library.add(blankSite())}>
              <PlusIcon />
              New empty site
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setLibraryOpen(true)}>
              <LayersIcon />
              My sites
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setVersionsOpen(true)}>
              <HistoryIcon />
              Versions
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={openPreviewTab}>
              <ExternalLinkIcon />
              Open the page in a tab
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setChecksOpen(true)}>
              <ListChecksIcon />
              Check before publishing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => library.duplicate()}>
              <LayersIcon />
              Duplicate this site
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
              <UploadIcon />
              Import a project file
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setHelpOpen(true)}>
              <KeyboardIcon />
              Tips and shortcuts
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                if (window.confirm(`Delete “${site.name}”? This cannot be undone.`)) library.remove(site.id);
              }}
            >
              <Trash2Icon />
              Delete this site
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {library.blocked && (
        <div role="alert" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-red-500/30 bg-red-500/5 px-4 py-2 text-xs">
          <span>Saving is paused. The sites already stored here could not be read, so nothing has been overwritten.</span>
          <Button
            size="sm"
            variant="outline"
            disabled={!library.recovery}
            onClick={() => {
              const url = URL.createObjectURL(new Blob([library.recovery], { type: "application/json" }));
              const link = document.createElement("a");
              link.href = url;
              link.download = "website-builder-recovery.json";
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 2000);
            }}
          >
            Download what is there
          </Button>
          <Button size="sm" variant="ghost" onClick={library.acceptOverwrite}>
            Save this site instead
          </Button>
        </div>
      )}

      {/* -------------------------------------------------------------- body */}
      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "border-border/80 bg-background w-full shrink-0 flex-col border-r lg:flex lg:w-60",
            pane === "sections" ? "flex" : "hidden",
          )}
        >
          <Outline
            blocks={site.blocks}
            selected={selected}
            onSelect={(id) => {
              setSelected(id);
              setPanel("section");
              setScrollTo({ id, at: Date.now() });
              setPane("preview");
            }}
            onReorder={reorder}
            onToggle={(id) => writeBlocks((blocks) => blocks.map((entry) => (entry.id === id ? { ...entry, hidden: !entry.hidden } : entry)))}
            onDuplicate={copyBlock}
            onDelete={removeBlock}
            onAdd={() => setPickerOpen(true)}
          />
        </aside>

        <main className={cn("min-h-0 min-w-0 flex-1 flex-col lg:flex", pane === "preview" ? "flex" : "hidden")}>
          <div className="border-border/80 flex items-center justify-between gap-2 border-b px-3 py-1.5">
            <div className="flex gap-0.5 md:hidden">
              {deviceButtons.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setDevice(entry.id)}
                  aria-label={entry.label}
                  className={cn("rounded-md p-1.5", device === entry.id ? "bg-muted text-foreground" : "text-muted-foreground")}
                >
                  <entry.icon className="size-4" />
                </button>
              ))}
            </div>
            <button
              onClick={() => setInline((value) => !value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors",
                inline ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={inline}
            >
              <PencilIcon className="size-3" />
              {inline ? "Click the page to edit text" : "Text editing off"}
            </button>
            <span className="text-muted-foreground hidden text-[11px] sm:inline">
              {site.theme.scheme === "dark" ? "Dark page" : "Light page"}
            </span>
          </div>
          <Canvas
            site={site}
            selected={selected}
            device={device}
            inline={inline}
            scrollTo={scrollTo}
            onSelect={(id, field) => {
              setSelected(id);
              setPanel("section");
              setFocusField(field ? `${field}` : "");
            }}
            onInlineEdit={inline ? applyInline : () => undefined}
            onShortcut={shortcut}
          />
        </main>

        <aside
          className={cn(
            "border-border/80 bg-background w-full shrink-0 flex-col border-l lg:flex lg:w-[340px]",
            pane === "edit" ? "flex" : "hidden",
          )}
        >
          <div className="border-border/80 flex shrink-0 gap-0.5 border-b p-1.5">
            {([
              { id: "section", label: "Section", icon: SlidersHorizontalIcon },
              { id: "design", label: "Design", icon: PaletteIcon },
              { id: "page", label: "Page", icon: LayoutTemplateIcon },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPanel(tab.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors",
                  panel === tab.id ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.icon className="size-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {panel === "section" && (
              block ? (
                <Inspector
                  key={block.id}
                  block={block}
                  anchors={anchors}
                  anchor={anchorOf(block.id)}
                  focus={focusField}
                  onProps={(patch, tag) => setProps(block.id, patch, tag)}
                  onVariant={(variant) => writeBlocks((blocks) => blocks.map((entry) => (entry.id === block.id ? { ...entry, variant } : entry)))}
                  onHidden={(hidden) => writeBlocks((blocks) => blocks.map((entry) => (entry.id === block.id ? { ...entry, hidden } : entry)))}
                  onDuplicate={() => copyBlock(block.id)}
                  onDelete={() => removeBlock(block.id)}
                />
              ) : (
                <div className="text-muted-foreground p-6 text-center text-sm leading-6">
                  Pick a section on the page or in the list to edit it.
                  <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => setPickerOpen(true)}>
                    <PlusIcon />
                    Add a section
                  </Button>
                </div>
              )
            )}
            {panel === "design" && <DesignPanel theme={site.theme} onChange={setTheme} />}
            {panel === "page" && <PagePanel site={site} onChange={(patch, tag) => library.update(patch, { tag })} />}
          </div>
        </aside>
      </div>

      {/* --------------------------------------------------------- mobile nav */}
      <nav className="border-border/80 grid shrink-0 grid-cols-3 border-t lg:hidden">
        {([
          { id: "sections", label: "Sections", icon: LayersIcon },
          { id: "preview", label: "Preview", icon: MonitorIcon },
          { id: "edit", label: "Edit", icon: SlidersHorizontalIcon },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setPane(tab.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 text-[10px]",
              pane === tab.id ? "text-primary" : "text-muted-foreground",
            )}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ----------------------------------------------------------- dialogs */}
      <StartDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        dismissible={!library.fresh || library.sites.length > 1}
        onCreate={(next) => {
          library.add(next);
          setSelected(next.blocks[0]?.id ?? "");
          setPane("preview");
          toast.success("Your site is ready. Click any text on the page to change it.");
        }}
      />
      <SectionPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={addBlock}
        present={site.blocks.map((entry) => entry.type)}
      />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} site={site} />
      <ChecksPanel open={checksOpen} onOpenChange={setChecksOpen} results={checks} onJump={jump} />

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">My sites</DialogTitle>
            <DialogDescription>Everything you build here is kept in this browser and saved as you type.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-1 overflow-y-auto">
            {library.sites.map((entry) => (
              <button
                key={entry.id}
                onClick={() => {
                  library.open(entry.id);
                  setSelected("");
                  setLibraryOpen(false);
                }}
                className={cn("hover:bg-muted w-full rounded-lg p-3 text-left transition-colors", entry.id === site.id && "bg-muted")}
              >
                <p className="truncate text-sm font-medium">{entry.name || "Untitled site"}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {entry.blocks.length} sections · {new Date(entry.updated).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
          <div className="border-border/70 flex flex-wrap gap-2 border-t pt-3">
            <Button
              size="sm"
              onClick={() => {
                setLibraryOpen(false);
                setStartOpen(true);
              }}
            >
              <PlusIcon />
              New site
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([JSON.stringify(library.sites, null, 2)], { type: "application/json" }));
                const link = document.createElement("a");
                link.href = url;
                link.download = "website-builder-backup.json";
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
              }}
            >
              <DownloadIcon />
              Back up everything
            </Button>
            <Button size="sm" variant="ghost" onClick={() => fileInput.current?.click()}>
              <UploadIcon />
              Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Versions</DialogTitle>
            <DialogDescription>Save a checkpoint before trying something bold, then come back if it did not work.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              aria-label="Version name"
              placeholder="Before the redesign"
              value={versionName}
              onChange={(event) => setVersionName(event.target.value)}
            />
            <Button
              onClick={() => {
                library.saveSnapshot(versionName);
                setVersionName("");
              }}
            >
              Save now
            </Button>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {site.snapshots.map((snapshot) => (
              <div key={snapshot.id} className="border-border/80 flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{snapshot.name}</p>
                  <p className="text-muted-foreground text-[11px]">
                    {new Date(snapshot.date).toLocaleString()} · {snapshot.blocks.length} sections
                  </p>
                </div>
                <div className="flex shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      library.restoreSnapshot(snapshot);
                      setVersionsOpen(false);
                    }}
                  >
                    Restore
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${snapshot.name}`} onClick={() => library.dropSnapshot(snapshot.id)}>
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
            ))}
            {!site.snapshots.length && <p className="text-muted-foreground py-6 text-center text-sm">No versions saved yet.</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Tips and shortcuts</DialogTitle>
            <DialogDescription>Three minutes here saves an hour later.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-3 text-sm">
            {[
              ["Click text on the page", "Type straight onto your website. No form, no preview gap."],
              ["Drag sections in the left list", "Order is the whole layout. Move the thing people care about higher."],
              ["Design tab", "One colour change restyles the page. The contrast readout tells you if it is still readable."],
              ["Checks", "Run it before you publish. It catches dead links, missing descriptions and leftover example text."],
              ["⌘/Ctrl + Z", "Undo. Shift adds redo. Everything is undoable, including deleting a section."],
              ["⌘/Ctrl + S", "Opens the export panel."],
            ].map(([title, detail]) => (
              <li key={title} className="flex gap-3">
                <span className="bg-muted mt-0.5 shrink-0 rounded px-2 py-0.5 font-mono text-[11px]">{title}</span>
                <span className="text-muted-foreground text-xs leading-5">{detail}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-label="Import a project file"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (file.size > 20_000_000) {
            toast.error("That file is too big to be a project backup.");
            return;
          }
          if (library.importSites(await file.text())) {
            setSelected("");
            setLibraryOpen(false);
          }
        }}
      />
    </div>
  );
}

/* --------------------------------------------------------------- page tab */

function PagePanel({ site, onChange }: { site: Site; onChange: (patch: Partial<Site>, tag?: string) => void }) {
  const meta = site.meta;
  const setMeta = (patch: Partial<Site["meta"]>, tag?: string) => onChange({ meta: { ...meta, ...patch } }, tag);
  const title = meta.title.trim() || site.name;
  const host = meta.url.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "") || "yoursite.com";

  return (
    <div className="space-y-5 px-4 py-4">
      <section className="space-y-2">
        <Label className="text-xs">How it looks in Google</Label>
        <div className="border-border/80 bg-muted/30 rounded-lg border p-3">
          <p className="text-muted-foreground truncate text-[11px]">{host}</p>
          <p className="mt-0.5 truncate text-sm text-blue-700 dark:text-blue-400">{title}</p>
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-5">
            {meta.description.trim() || "Add a description so search results say something useful about your page."}
          </p>
        </div>
      </section>

      <Row id="sb-meta-title" label="Page title" hint="Shown in the browser tab and as the search result heading. Around 55 characters.">
        <Input id="sb-meta-title" value={meta.title} placeholder={site.name} onChange={(event) => setMeta({ title: event.target.value }, "title")} className="h-9 text-sm" />
      </Row>

      <Row id="sb-meta-desc" label="Description" hint="One or two sentences. 120 to 155 characters reads best.">
        <Textarea
          id="sb-meta-desc"
          value={meta.description}
          rows={3}
          placeholder="What this page offers, in plain words."
          onChange={(event) => setMeta({ description: event.target.value }, "description")}
          className="text-sm"
        />
        <p className={cn("mt-1 text-[10px] tabular-nums", meta.description.length > 165 ? "text-amber-600" : "text-muted-foreground/70")}>
          {meta.description.length}/155
        </p>
      </Row>

      <Row id="sb-meta-favicon" label="Tab icon" hint="One emoji becomes the little icon in the browser tab.">
        <Input
          id="sb-meta-favicon"
          value={meta.favicon}
          onChange={(event) => setMeta({ favicon: [...event.target.value].slice(0, 2).join("") })}
          className="h-9 w-20 text-center text-lg"
          aria-label="Tab icon emoji"
        />
      </Row>

      <Row id="sb-meta-business" label="Business name" hint="Used for search engines' business card, alongside your contact details.">
        <Input
          id="sb-meta-business"
          value={site.identity.name}
          placeholder={site.name}
          onChange={(event) => onChange({ identity: { ...site.identity, name: event.target.value } }, "identity")}
          className="h-9 text-sm"
        />
      </Row>

      <Row id="sb-meta-url" label="Web address" hint="Fill this in once you know it. It helps search engines and link previews.">
        <Input
          id="sb-meta-url"
          value={meta.url}
          placeholder="https://yoursite.com"
          onChange={(event) => setMeta({ url: event.target.value }, "url")}
          className="h-9 text-sm"
        />
      </Row>

      <Row id="sb-meta-og" label="Sharing picture" hint="Shown when someone posts your link on social media. A full web address to an image.">
        <Input
          id="sb-meta-og"
          value={meta.ogImage}
          placeholder="https://yoursite.com/preview.jpg"
          onChange={(event) => setMeta({ ogImage: event.target.value }, "og")}
          className="h-9 text-sm"
        />
      </Row>

      <Row id="sb-meta-lang" label="Language" hint="Two-letter code: en, pt, fr, de">
        <Input
          id="sb-meta-lang"
          value={meta.lang}
          onChange={(event) => setMeta({ lang: event.target.value.slice(0, 5) })}
          className="h-9 w-24 text-sm"
        />
      </Row>

      <div className="border-border/70 flex items-center justify-between gap-3 border-t pt-4">
        <div>
          <Label htmlFor="sb-index" className="text-xs">Let search engines list it</Label>
          <p className="text-muted-foreground text-[11px] leading-4">Turn off while the page is still a work in progress.</p>
        </div>
        <Switch id="sb-index" checked={meta.indexable} onCheckedChange={(next) => setMeta({ indexable: next })} />
      </div>

      <p className="text-muted-foreground border-border/70 border-t pt-4 text-[11px] leading-5">
        The export already includes a description card for search engines, link-preview tags and, when you have a questions
        section, the structured data Google uses to show answers.
      </p>
    </div>
  );
}

function Row({ id, label, hint, children }: { id: string; label: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      {children}
      <p className="text-muted-foreground text-[11px] leading-4">{hint}</p>
    </section>
  );
}

/* ----------------------------------------------------------- first paint */

function Skeleton() {
  return (
    <div className="bg-background flex h-full min-h-0 flex-col" aria-busy="true">
      <div className="border-border/80 flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <div className="bg-muted size-8 animate-pulse rounded-lg" />
        <div className="bg-muted h-4 w-40 animate-pulse rounded" />
        <div className="flex-1" />
        <div className="bg-muted h-8 w-24 animate-pulse rounded-lg" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="border-border/80 hidden w-60 shrink-0 flex-col gap-2 border-r p-3 lg:flex">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="bg-muted h-10 animate-pulse rounded-lg" style={{ opacity: 1 - index * 0.13 }} />
          ))}
        </div>
        <div className="bg-muted/40 flex min-h-0 flex-1 items-center justify-center p-4">
          <p className="text-muted-foreground text-sm">Opening your workspace…</p>
        </div>
        <div className="border-border/80 hidden w-[340px] shrink-0 flex-col gap-3 border-l p-4 lg:flex">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="bg-muted h-9 animate-pulse rounded-lg" style={{ opacity: 1 - index * 0.15 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
