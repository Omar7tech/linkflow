"use client";

import * as React from "react";
import {
  BracesIcon,
  ChevronsLeftRightIcon,
  CodeIcon,
  DownloadIcon,
  EyeIcon,
  FileCodeIcon,
  FolderOpenIcon,
  KeyboardIcon,
  LayoutPanelLeftIcon,
  LibraryIcon,
  Link2Icon,
  MaximizeIcon,
  MinimizeIcon,
  PaletteIcon,
  PlayIcon,
  SaveIcon,
  SettingsIcon,
  SparklesIcon,
  TerminalIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { EDITOR_THEMES, type EditorLang } from "@/lib/editor-highlight";
import {
  buildPreviewDocument,
  createSketch,
  decodeSketchFromHash,
  encodeSketchToHash,
  exportProjectFiles,
  exportSingleFile,
  EDITOR_LIBRARIES,
  findTagOffset,
  formatBytes,
  sketchSlug,
  STORAGE_KEYS,
  type PaneId,
  type Sketch,
} from "@/lib/live-editor";
import { SKETCH_TEMPLATES, TEMPLATE_BY_ID } from "@/lib/live-editor-templates";
import { cn } from "@/lib/utils";
import { buildZip } from "@/lib/zip";
import { CodePane, type PaneSettings, type RevealRequest } from "./code-pane";
import { ConsolePane, type ConsoleEntry, type ConsoleLevel } from "./console-pane";
import { PreviewPane, type HoverInfo } from "./preview-pane";

interface EditorSettings extends PaneSettings {
  autoRun: boolean;
  stacked: boolean;
  split: number;
}

const DEFAULT_SETTINGS: EditorSettings = {
  theme: "emerald",
  fontFamily: "var(--font-mono), ui-monospace, monospace",
  fontSize: 13,
  tabSize: 2,
  wrap: false,
  lineNumbers: true,
  autoComplete: true,
  autoClose: true,
  autoRun: true,
  stacked: false,
  split: 0.5,
};

const FONT_CHOICES = [
  { label: "Geist Mono", value: "var(--font-mono), ui-monospace, monospace" },
  { label: "System mono", value: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  { label: "Consolas", value: "Consolas, 'Courier New', monospace" },
  { label: "Courier", value: "'Courier New', Courier, monospace" },
];

const PANES: { id: PaneId; label: string; lang: EditorLang; icon: typeof CodeIcon }[] = [
  { id: "html", label: "HTML", lang: "html", icon: CodeIcon },
  { id: "css", label: "CSS", lang: "css", icon: PaletteIcon },
  { id: "js", label: "JS", lang: "js", icon: BracesIcon },
];

const SHORTCUTS: [string, string][] = [
  ["Ctrl / ⌘ + Enter", "Run the preview"],
  ["Ctrl / ⌘ + S", "Save the sketch"],
  ["Ctrl / ⌘ + 1 / 2 / 3", "Jump to HTML / CSS / JS"],
  ["Tab", "Expand an Emmet abbreviation, or indent"],
  ["Ctrl / ⌘ + Space", "Force the completion list"],
  ["Ctrl / ⌘ + /", "Toggle comment"],
  ["Ctrl / ⌘ + D", "Duplicate the line"],
  ["Alt + ↑ / ↓", "Move the line"],
  ["Alt + Shift + F", "Tidy indentation"],
  ["Ctrl + mouse wheel", "Change the font size"],
  ["Esc", "Leave focus mode"],
];

const MAX_CONSOLE_ENTRIES = 400;

export function LiveEditorTool() {
  const tool = TOOL_BY_ID.editor;
  const [storedSketch, setStoredSketch, storageReady] = useLocalStorage<Sketch | null>(
    STORAGE_KEYS.current,
    null
  );
  const [library, setLibrary] = useLocalStorage<Sketch[]>(STORAGE_KEYS.sketches, []);
  const [settings, setSettings] = useLocalStorage<EditorSettings>(
    STORAGE_KEYS.settings,
    DEFAULT_SETTINGS
  );

  const [sketch, setSketch] = React.useState<Sketch>(() =>
    createSketch({ name: "My first page", ...pickTemplate("blank") })
  );
  const [activePane, setActivePane] = React.useState<PaneId>("html");
  const [mobileView, setMobileView] = React.useState<"code" | "preview">("code");
  const [srcDoc, setSrcDoc] = React.useState("");
  const [runKey, setRunKey] = React.useState(0);
  const [entries, setEntries] = React.useState<ConsoleEntry[]>([]);
  const [consoleOpen, setConsoleOpen] = React.useState(false);
  const [inspecting, setInspecting] = React.useState(false);
  const [hover, setHover] = React.useState<HoverInfo | null>(null);
  const [deviceWidth, setDeviceWidth] = React.useState<number | null>(null);
  const [caret, setCaret] = React.useState({ line: 1, column: 1 });
  const [reveal, setReveal] = React.useState<RevealRequest | null>(null);
  const [focusMode, setFocusMode] = React.useState(false);

  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const restoredRef = React.useRef(false);
  const entryIdRef = React.useRef(0);
  const inspectingRef = React.useRef(false);
  const workspaceRef = React.useRef<HTMLDivElement>(null);

  // Stamped on every message in both directions, so a message from any other
  // frame on the page is ignored instead of injecting console output or faking
  // an inspector pick. `useId` gives one value per editor instance.
  const token = `ed${React.useId()}`;

  const merged = React.useMemo<EditorSettings>(
    () => ({ ...DEFAULT_SETTINGS, ...settings }),
    [settings]
  );
  const updateSettings = React.useCallback(
    (patch: Partial<EditorSettings>) =>
      setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...prev, ...patch })),
    [setSettings]
  );

  const errorCount = React.useMemo(
    () => entries.filter((entry) => entry.level === "error").length,
    [entries]
  );

  /* ------------------------------------------------------------ running */

  const run = React.useCallback(
    (next: Sketch) => {
      setEntries([]);
      setSrcDoc(buildPreviewDocument(next, { token }));
      setRunKey((key) => key + 1);
    },
    [token]
  );

  // Timers and shortcuts fire long after the render that scheduled them, so
  // they read the sketch from a ref rather than capturing a stale copy.
  const sketchRef = React.useRef(sketch);
  React.useEffect(() => {
    sketchRef.current = sketch;
  }, [sketch]);

  const runCurrent = React.useCallback(() => run(sketchRef.current), [run]);

  // Markup and script changes need a fresh document…
  React.useEffect(() => {
    // The restore effect below owns the very first run, so this one stays out
    // of the way until there is something real to re-run.
    if (!merged.autoRun || !restoredRef.current) return;
    const id = setTimeout(runCurrent, 550);
    return () => clearTimeout(id);
  }, [sketch.html, sketch.js, sketch.libs, merged.autoRun, runCurrent]);

  // …but CSS is swapped into the running page, so animations, scroll position
  // and any state the sketch built up survive the edit.
  React.useEffect(() => {
    if (!merged.autoRun) return;
    const id = setTimeout(() => {
      frameRef.current?.contentWindow?.postMessage(
        { source: token, type: "css", payload: sketch.css },
        "*"
      );
    }, 140);
    return () => clearTimeout(id);
  }, [sketch.css, merged.autoRun, token]);

  /* ----------------------------------------------------- bridge messages */

  const pushEntry = React.useCallback((level: ConsoleLevel, parts: string[]) => {
    setEntries((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.level === level && last.parts.join(" ") === parts.join(" ")) {
        return [...prev.slice(0, -1), { ...last, count: last.count + 1 }];
      }
      const next = [...prev, { id: entryIdRef.current++, level, parts, count: 1 }];
      return next.length > MAX_CONSOLE_ENTRIES ? next.slice(-MAX_CONSOLE_ENTRIES) : next;
    });
  }, []);

  const jumpToSource = React.useCallback(
    (info: { tag: string; index: number; selector: string }) => {
      const offset = findTagOffset(sketch.html, info.tag, info.index);
      if (offset === null) {
        toast.info(`${info.selector} was created by script — nothing to jump to`);
        return;
      }
      setActivePane("html");
      setMobileView("code");
      setReveal({ offset, nonce: Date.now() });
    },
    [sketch.html]
  );

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string; type?: string; payload?: unknown };
      if (!data || data.source !== token) return;

      switch (data.type) {
        case "console": {
          const payload = data.payload as { level: ConsoleLevel; parts: string[] };
          pushEntry(payload.level, payload.parts);
          if (payload.level === "error") setConsoleOpen(true);
          break;
        }
        case "clear":
          setEntries([]);
          break;
        case "eval-result": {
          const payload = data.payload as { ok: boolean; text: string };
          pushEntry(payload.ok ? "result" : "error", [payload.text]);
          break;
        }
        case "inspect-hover":
          setHover(data.payload as HoverInfo);
          break;
        case "inspect-pick":
          jumpToSource(data.payload as { tag: string; index: number; selector: string });
          break;
        case "boot":
          // A fresh document doesn't know we were inspecting.
          if (inspectingRef.current) {
            frameRef.current?.contentWindow?.postMessage(
              { source: token, type: "inspect", payload: true },
              "*"
            );
          }
          break;
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [jumpToSource, pushEntry, token]);

  const toggleInspect = React.useCallback(() => {
    const next = !inspecting;
    setInspecting(next);
    inspectingRef.current = next;
    if (!next) setHover(null);
    frameRef.current?.contentWindow?.postMessage({ source: token, type: "inspect", payload: next }, "*");
  }, [inspecting, token]);

  const evaluate = React.useCallback((code: string) => {
    pushEntry("input", [code]);
    frameRef.current?.contentWindow?.postMessage(
      { source: token, type: "eval", payload: { code, id: Date.now() } },
      "*"
    );
  }, [pushEntry, token]);

  /* ------------------------------------------------------- restore state */

  // Runs once, as soon as localStorage is readable: a shared link wins over the
  // autosaved draft, which wins over the starter the component mounted with.
  // Reading storage during render would break hydration, so this is one of the
  // cases where an effect legitimately seeds state.
  React.useEffect(() => {
    if (restoredRef.current || !storageReady) return;
    restoredRef.current = true;

    const hash = window.location.hash;
    if (hash.startsWith("#s=")) {
      decodeSketchFromHash(hash.slice(3)).then((shared) => {
        if (!shared) {
          toast.error("That shared link couldn't be read");
          runCurrent();
          return;
        }
        setSketch(shared);
        run(shared);
        toast.success("Loaded the shared sketch");
      });
      return;
    }

    if (storedSketch?.html !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from storage
      setSketch(storedSketch);
      run(storedSketch);
      return;
    }
    runCurrent();
  }, [storageReady, storedSketch, run, runCurrent]);

  // Autosave — the work in progress survives a refresh without a save step.
  React.useEffect(() => {
    if (!restoredRef.current) return;
    const id = setTimeout(() => setStoredSketch({ ...sketch, updatedAt: Date.now() }), 900);
    return () => clearTimeout(id);
  }, [sketch, setStoredSketch]);

  /* ------------------------------------------------------------ actions */

  const update = React.useCallback(
    (pane: PaneId, code: string) =>
      setSketch((prev) => ({ ...prev, [pane]: code, updatedAt: Date.now() })),
    []
  );

  const loadTemplate = React.useCallback((id: string) => {
    const template = TEMPLATE_BY_ID.get(id);
    if (!template) return;
    const next = createSketch({
      name: template.name,
      html: template.html,
      css: template.css,
      js: template.js,
      libs: template.libs ?? [],
    });
    setSketch(next);
    run(next);
    toast.success(`Loaded “${template.name}”`);
  }, [run]);

  const toggleLibrary = React.useCallback(
    (id: string) =>
      setSketch((prev) => ({
        ...prev,
        libs: prev.libs.includes(id) ? prev.libs.filter((l) => l !== id) : [...prev.libs, id],
      })),
    []
  );

  const saveSketch = React.useCallback(() => {
    const snapshot = { ...sketch, updatedAt: Date.now() };
    setLibrary((prev) => {
      const existing = prev.findIndex((item) => item.id === snapshot.id);
      if (existing === -1) return [snapshot, ...prev].slice(0, 30);
      const next = [...prev];
      next[existing] = snapshot;
      return next;
    });
    toast.success(`Saved “${snapshot.name}”`);
  }, [setLibrary, sketch]);

  const share = React.useCallback(async () => {
    try {
      const hash = await encodeSketchToHash(sketch);
      const url = `${window.location.origin}${window.location.pathname}#s=${hash}`;
      if (url.length > 30000) {
        toast.error("This sketch is too big for a link — download the zip instead");
        return;
      }
      await navigator.clipboard.writeText(url);
      window.history.replaceState(null, "", `#s=${hash}`);
      toast.success("Share link copied", { description: `${(url.length / 1024).toFixed(1)} KB link` });
    } catch {
      toast.error("Couldn't build the share link");
    }
  }, [sketch]);

  const download = React.useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const downloadHtml = React.useCallback(() => {
    download(new Blob([exportSingleFile(sketch)], { type: "text/html" }), `${sketchSlug(sketch.name)}.html`);
    toast.success("Downloaded a single HTML file");
  }, [download, sketch]);

  const downloadZip = React.useCallback(() => {
    const encoder = new TextEncoder();
    const files = exportProjectFiles(sketch).map((file) => ({
      name: file.name,
      data: encoder.encode(file.content),
    }));
    download(buildZip(files), `${sketchSlug(sketch.name)}.zip`);
    toast.success("Downloaded index.html, style.css and script.js");
  }, [download, sketch]);

  const copyHtml = React.useCallback(async () => {
    await navigator.clipboard.writeText(exportSingleFile(sketch));
    toast.success("Full page copied to the clipboard");
  }, [sketch]);

  const openExternal = React.useCallback(() => {
    const blob = new Blob([exportSingleFile(sketch)], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, [sketch]);

  const changeFontSize = React.useCallback(
    (delta: number) =>
      updateSettings({
        fontSize: Math.min(24, Math.max(10, merged.fontSize + delta)),
      }),
    [merged.fontSize, updateSettings]
  );

  const paneChangeHandlers = React.useMemo(
    () => ({
      html: (code: string) => update("html", code),
      css: (code: string) => update("css", code),
      js: (code: string) => update("js", code),
    }),
    [update]
  );
  const clearConsole = React.useCallback(() => setEntries([]), []);

  /* --------------------------------------------------------- shortcuts */

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key === "Enter") {
        event.preventDefault();
        runCurrent();
        return;
      }
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveSketch();
        return;
      }
      if (mod && ["1", "2", "3"].includes(event.key)) {
        event.preventDefault();
        setActivePane(PANES[Number(event.key) - 1].id);
        setMobileView("code");
        return;
      }
      if (event.key === "Escape") setFocusMode(false);
    };

    const node = workspaceRef.current;
    node?.addEventListener("keydown", onKeyDown);
    return () => node?.removeEventListener("keydown", onKeyDown);
  }, [runCurrent, saveSketch]);

  /* ----------------------------------------------------------- resizing */

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const container = workspaceRef.current?.querySelector("[data-split-container]");
    if (!container) return;
    const bounds = container.getBoundingClientRect();

    const onMove = (move: PointerEvent) => {
      const ratio = (move.clientX - bounds.left) / bounds.width;
      updateSettings({ split: Math.min(0.8, Math.max(0.2, ratio)) });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  /* -------------------------------------------------------------- render */

  const paneSettings: PaneSettings = merged;

  const editorColumn = (
    <div className="bg-card flex min-h-0 flex-1 flex-col">
      <div className="border-border/60 flex items-stretch gap-px border-b">
        {PANES.map((pane) => (
          <button
            key={pane.id}
            type="button"
            onClick={() => setActivePane(pane.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
              !merged.stacked && activePane === pane.id
                ? "text-foreground border-primary border-b-2"
                : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
            )}
          >
            <pane.icon className="size-3.5" aria-hidden />
            {pane.label}
            <span className="text-muted-foreground/60 font-mono text-[10px]">
              {formatBytes(sketch[pane.id].length)}
            </span>
          </button>
        ))}

        <div className="ml-auto flex items-center pr-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => updateSettings({ stacked: !merged.stacked })}
                aria-pressed={merged.stacked}
                aria-label="Toggle stacked panes"
              >
                <LayoutPanelLeftIcon className={merged.stacked ? "text-primary" : undefined} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{merged.stacked ? "Show one pane" : "Show all three panes"}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className={cn("min-h-0 flex-1", merged.stacked && "flex flex-col divide-y divide-border/60")}>
        {PANES.map((pane) => {
          const visible = merged.stacked || activePane === pane.id;
          return (
            <div
              key={pane.id}
              className={cn("min-h-0", merged.stacked ? "flex-1" : "h-full", !visible && "hidden")}
            >
              <CodePane
                value={sketch[pane.id]}
                onChange={paneChangeHandlers[pane.id]}
                lang={pane.lang}
                label={`${pane.label} source`}
                settings={paneSettings}
                enabledLibraries={sketch.libs}
                onRun={runCurrent}
                onSave={saveSketch}
                onCaretChange={setCaret}
                onZoom={changeFontSize}
                reveal={pane.id === "html" ? reveal : null}
                className="h-full"
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  const previewColumn = (
    <div className="border-border/60 bg-card flex min-h-0 flex-1 flex-col overflow-hidden">
      <PreviewPane
        frameRef={frameRef}
        srcDoc={srcDoc}
        runKey={runKey}
        deviceWidth={deviceWidth}
        onDeviceWidthChange={setDeviceWidth}
        inspecting={inspecting}
        onToggleInspect={toggleInspect}
        hover={hover}
        onReload={runCurrent}
        onOpenExternal={openExternal}
      />

      <div
        className={cn(
          "border-border/60 flex flex-col border-t",
          consoleOpen ? "h-52 min-h-0" : "h-auto"
        )}
      >
        <button
          type="button"
          onClick={() => setConsoleOpen((open) => !open)}
          className="hover:bg-muted/50 flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors"
          aria-expanded={consoleOpen}
        >
          <TerminalIcon className="size-3.5" aria-hidden />
          Console
          {errorCount > 0 && (
            <span className="rounded-full bg-red-500/15 px-1.5 font-mono text-[10px] font-semibold text-red-600 dark:text-red-400">
              {errorCount}
            </span>
          )}
          {entries.length > 0 && errorCount === 0 && (
            <span className="bg-muted text-muted-foreground rounded-full px-1.5 font-mono text-[10px]">
              {entries.length}
            </span>
          )}
          <ChevronsLeftRightIcon
            className={cn("text-muted-foreground ml-auto size-3.5 rotate-90 transition-transform", consoleOpen && "-rotate-90")}
            aria-hidden
          />
        </button>

        {consoleOpen && (
          <ConsolePane entries={entries} onClear={clearConsole} onEvaluate={evaluate} />
        )}
      </div>
    </div>
  );

  const workspace = (
    <div
      ref={workspaceRef}
      className={cn(
        "flex flex-col gap-3",
        focusMode ? "bg-background fixed inset-0 z-50 p-3" : ""
      )}
    >
      {/* ------------------------------------------------------ toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={sketch.name}
          onChange={(event) => setSketch((prev) => ({ ...prev, name: event.target.value }))}
          aria-label="Sketch name"
          className="h-8 w-40 text-sm font-medium sm:w-52"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <SparklesIcon /> Starters
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Load a starter</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SKETCH_TEMPLATES.map((template) => (
              <DropdownMenuItem
                key={template.id}
                onSelect={() => loadTemplate(template.id)}
                className="flex-col items-start gap-0.5"
              >
                <span className="font-medium">{template.name}</span>
                <span className="text-muted-foreground text-xs">{template.blurb}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <LibraryIcon /> Libraries &amp; IntelliSense
              {sketch.libs.length > 0 && (
                <span className="bg-primary/15 text-primary rounded-full px-1.5 font-mono text-[10px] font-semibold">
                  {sketch.libs.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Add a library and its code suggestions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {EDITOR_LIBRARIES.map((lib) => (
              <DropdownMenuCheckboxItem
                key={lib.id}
                checked={sketch.libs.includes(lib.id)}
                onCheckedChange={() => toggleLibrary(lib.id)}
                onSelect={(event) => event.preventDefault()}
                className="flex-col items-start gap-0.5"
              >
                <span className="font-medium">{lib.name}</span>
                <span className="text-muted-foreground text-xs">{lib.blurb}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <SketchLibraryMenu
          library={library}
          onLoad={(item) => {
            setSketch(item);
            run(item);
            toast.success(`Opened “${item.name}”`);
          }}
          onDelete={(id) => setLibrary((prev) => prev.filter((item) => item.id !== id))}
          onNew={() => {
            const next = createSketch({ name: "Untitled sketch", ...pickTemplate("blank") });
            setSketch(next);
            run(next);
          }}
        />

        <div className="ml-auto flex items-center gap-2">
          <label className="hidden cursor-pointer items-center gap-2 text-xs sm:flex">
            <Switch
              checked={merged.autoRun}
              onCheckedChange={(value) => updateSettings({ autoRun: value })}
              aria-label="Auto-run"
            />
            Auto-run
          </label>

          <Button size="sm" onClick={runCurrent} className="font-semibold">
            <PlayIcon /> Run
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon-sm" onClick={saveSketch} aria-label="Save sketch">
                <SaveIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save (Ctrl+S)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon-sm" onClick={share} aria-label="Copy share link">
                <Link2Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy a link that carries the whole sketch</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Export">
                <DownloadIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={downloadHtml}>
                <FileCodeIcon /> Download index.html
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={downloadZip}>
                <DownloadIcon /> Download .zip (3 files)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={copyHtml}>
                <CodeIcon /> Copy full page
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <SettingsMenu settings={merged} onChange={updateSettings} />
          <ShortcutsDialog />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setFocusMode((value) => !value)}
                aria-label={focusMode ? "Leave focus mode" : "Focus mode"}
              >
                {focusMode ? <MinimizeIcon /> : <MaximizeIcon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{focusMode ? "Leave focus mode" : "Fill the screen"}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="border-border/60 bg-muted/20 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs">
        <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 font-semibold">
          New here?
        </span>
        <span className="text-muted-foreground">
          Start with the complete HTML page. Type <strong className="text-foreground">&lt;</strong> for tags,
          press <strong className="text-foreground">Ctrl+Space</strong> for suggestions, and enable Tailwind
          under <strong className="text-foreground">Libraries &amp; IntelliSense</strong> for class completions.
        </span>
        <span className="text-muted-foreground/80 ml-auto font-mono text-[10px]">
          Saved locally in this browser
        </span>
      </div>

      {/* --------------------------------------------------- mobile tabs */}
      <div className="flex gap-1 lg:hidden">
        {(["code", "preview"] as const).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => setMobileView(view)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium capitalize transition-colors",
              mobileView === view ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            {view === "code" ? <CodeIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
            {view}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------ the panes */}
      <div
        data-split-container
        className={cn(
          "border-border/60 flex min-h-0 overflow-hidden rounded-xl border",
          focusMode ? "flex-1" : "h-[min(76vh,820px)] min-h-[30rem]"
        )}
      >
        <div
          className={cn(
            // Full width on phones where the preview is a separate tab; on
            // desktop the drag handle drives the basis.
            "min-w-0 shrink basis-full flex-col lg:grow-0 lg:basis-[var(--split)]",
            mobileView === "code" ? "flex" : "hidden",
            "lg:flex"
          )}
          style={{ "--split": `${merged.split * 100}%` } as React.CSSProperties}
        >
          {editorColumn}
        </div>

        <div
          onPointerDown={startResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panes"
          className="bg-border/60 hover:bg-primary/60 hidden w-1 shrink-0 cursor-col-resize transition-colors lg:block"
        />

        <div
          className={cn(
            "min-w-0 flex-1 flex-col",
            mobileView === "preview" ? "flex" : "hidden",
            "lg:flex"
          )}
        >
          {previewColumn}
        </div>
      </div>

      {/* ------------------------------------------------------ status bar */}
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]">
        <span>
          Ln {caret.line}, Col {caret.column}
        </span>
        <span className="uppercase">{merged.stacked ? "all panes" : activePane}</span>
        <span>{formatBytes(sketch.html.length + sketch.css.length + sketch.js.length)} total</span>
        {sketch.libs.length > 0 && <span>{sketch.libs.length} libraries</span>}
        <span className="ml-auto hidden sm:inline">
          Tab expands Emmet · Ctrl+Enter runs · Ctrl+Space completes
        </span>
      </div>
    </div>
  );

  return (
    <GeneratorLayout tool={tool} output={null} fullBleed>
      {workspace}
    </GeneratorLayout>
  );
}

/* ------------------------------------------------------------ sub-menus */

function pickTemplate(id: string) {
  const template = TEMPLATE_BY_ID.get(id) ?? SKETCH_TEMPLATES[0];
  return { html: template.html, css: template.css, js: template.js, libs: template.libs ?? [] };
}

function SketchLibraryMenu({
  library,
  onLoad,
  onDelete,
  onNew,
}: {
  library: Sketch[];
  onLoad: (sketch: Sketch) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderOpenIcon /> Sketches
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuItem onSelect={onNew}>
          <FileCodeIcon /> New blank sketch
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Saved here in this browser</DropdownMenuLabel>
        {library.length === 0 ? (
          <p className="text-muted-foreground px-2 py-1.5 text-xs">
            Nothing saved yet — press Ctrl+S.
          </p>
        ) : (
          library.map((item) => (
            <DropdownMenuItem
              key={item.id}
              onSelect={() => onLoad(item)}
              className="flex items-center gap-2"
            >
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <button
                type="button"
                aria-label={`Delete ${item.name}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(item.id);
                }}
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Settings live in a dialog rather than a dropdown: Radix `Select` renders into
 * its own portal, and a menu treats that portal as "outside", so every pick
 * would close the panel it was opened from.
 */
function SettingsMenu({
  settings,
  onChange,
}: {
  settings: EditorSettings;
  onChange: (patch: Partial<EditorSettings>) => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label="Editor settings">
          <SettingsIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editor settings</DialogTitle>
          <DialogDescription>Saved in this browser and applied to all three panes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">
              <PaletteIcon className="size-3.5" /> Editor theme
            </Label>
            <Select value={settings.theme} onValueChange={(value) => onChange({ theme: value })}>
              <SelectTrigger className="h-8 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITOR_THEMES.map((theme) => (
                  <SelectItem key={theme.id} value={theme.id}>
                    {theme.name}
                    <span className="text-muted-foreground ml-1.5 text-[10px]">
                      {theme.dark ? "dark" : "light"}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              <TypeIcon className="size-3.5" /> Font
            </Label>
            <Select
              value={settings.fontFamily}
              onValueChange={(value) => onChange({ fontFamily: value })}
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_CHOICES.map((font) => (
                  <SelectItem key={font.value} value={font.value}>
                    {font.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Font size</Label>
              <Select
                value={String(settings.fontSize)}
                onValueChange={(value) => onChange({ fontSize: Number(value) })}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[11, 12, 13, 14, 15, 16, 18, 20].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}px
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tab size</Label>
              <Select
                value={String(settings.tabSize)}
                onValueChange={(value) => onChange({ tabSize: Number(value) })}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 4, 8].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} spaces
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <SettingSwitch
              label="Line numbers"
              checked={settings.lineNumbers}
              onChange={(value) => onChange({ lineNumbers: value })}
            />
            <SettingSwitch
              label="Word wrap"
              checked={settings.wrap}
              onChange={(value) => onChange({ wrap: value })}
            />
            <SettingSwitch
              label="Autocomplete"
              checked={settings.autoComplete}
              onChange={(value) => onChange({ autoComplete: value })}
            />
            <SettingSwitch
              label="Close brackets & tags"
              checked={settings.autoClose}
              onChange={(value) => onChange({ autoClose: value })}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

function ShortcutsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label="Keyboard shortcuts">
          <KeyboardIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Everything the editor understands.</DialogDescription>
        </DialogHeader>
        <dl className="divide-border/60 divide-y text-sm">
          {SHORTCUTS.map(([keys, description]) => (
            <div key={keys} className="flex items-center justify-between gap-4 py-2">
              <dt className="text-muted-foreground">{description}</dt>
              <dd className="bg-muted rounded-md px-2 py-0.5 font-mono text-xs whitespace-nowrap">
                {keys}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
