"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ToggleGroup } from "radix-ui";
import { ArchiveIcon, ArrowRightIcon, CheckIcon, CircleHelpIcon, CopyIcon, DownloadIcon, FlaskConicalIcon, FocusIcon, InboxIcon, LayersIcon, PlusIcon, RotateCcwIcon, SaveIcon, SearchIcon, SparklesIcon, TrashIcon, Undo2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Field } from "@/components/shared/field";
import { CopyButton } from "@/components/shared/copy-button";
import { FavoriteButton } from "@/components/shared/favorite-button";
import { cn } from "@/lib/utils";
import { SECTIONS, STORAGE_KEY, TEMPLATE_DATA, assemblePrompt, newDraft, repeatedIdeas, repeatedSentences, reviewPrompt, splitThoughts, suggestSection, validDrafts, type Idea, type PromptDraft, type PromptFormat, type SectionId } from "@/lib/prompt-workbench";
import { IdeaCard } from "./idea-card";

const initial: PromptDraft = { id: "first-prompt", title: "My first prompt", scratch: "", role: "", format: "markdown", ideas: [], snapshots: [], updated: 0 };
function download(text: string, name: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PromptWorkbenchTool() {
  const [drafts, setDrafts] = useState<PromptDraft[]>([initial]);
  const [active, setActive] = useState(initial.id);
  const [ready, setReady] = useState(false);
  const [savingBlocked, setSavingBlocked] = useState(false);
  const [recovery, setRecovery] = useState("");
  const [status, setStatus] = useState("Opening your desk…");
  const [stage, setStage] = useState("capture");
  const [lane, setLane] = useState("all");
  const [query, setQuery] = useState("");
  const [quickIdea, setQuickIdea] = useState("");
  const [captureMode, setCaptureMode] = useState<"paragraphs" | "sentences">("paragraphs");
  const [focusMode, setFocusMode] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [comparedId, setComparedId] = useState("");
  const [snapshotName, setSnapshotName] = useState("");
  const [undo, setUndo] = useState<PromptDraft[]>([]);
  const [redo, setRedo] = useState<PromptDraft[]>([]);
  const [highlight, setHighlight] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const doc = drafts.find(d => d.id === active) ?? drafts[0];
  const finalPrompt = assemblePrompt(doc);
  const included = doc.ideas.filter(i => i.included && i.section !== "inbox" && i.text.trim());
  const inbox = doc.ideas.filter(i => i.section === "inbox" && i.included);
  const parked = doc.ideas.filter(i => !i.included);
  const findings = reviewPrompt(doc);
  const repeats = useMemo(() => repeatedIdeas(doc.ideas), [doc.ideas]);
  const echoes = useMemo(() => repeatedSentences(doc.ideas), [doc.ideas]);
  const coverage = SECTIONS.filter(s => included.some(i => i.section === s.id));
  const focus = included.find(i => i.section === "goal")?.text;
  const words = finalPrompt.trim().split(/\s+/).filter(Boolean).length;
  const compared = doc.snapshots.find(s => s.id === comparedId) ?? doc.snapshots[0];

  useEffect(() => {
    const timer = setTimeout(() => {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(STORAGE_KEY);
        if (raw) { const value: unknown = JSON.parse(raw); if (!validDrafts(value)) throw Error("Invalid library"); const lastActive = localStorage.getItem(`${STORAGE_KEY}:active`); setDrafts(value); setActive(value.some(d => d.id === lastActive) ? lastActive! : value[0].id); }
        setStatus("Saved on this device");
      } catch {
        setSavingBlocked(true); setRecovery(raw ?? ""); setStatus("Saving paused: existing library could not be opened");
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || savingBlocked) return;
    const save = () => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts)); localStorage.setItem(`${STORAGE_KEY}:active`, active); setStatus("Saved on this device"); }
      catch { setStatus("Storage unavailable. Download a backup to keep your work."); }
    };
    const timer = setTimeout(save, 350);
    window.addEventListener("pagehide", save);
    window.addEventListener("beforeunload", save);
    return () => { clearTimeout(timer); window.removeEventListener("pagehide", save); window.removeEventListener("beforeunload", save); };
  }, [drafts, active, ready, savingBlocked]);

  function update(patch: Partial<PromptDraft>, remember = true) {
    if (remember) { setUndo(prev => [...prev, doc].slice(-40)); setRedo([]); }
    setDrafts(prev => prev.map(d => d.id === doc.id ? { ...d, ...patch, updated: Date.now() } : d));
    if (!savingBlocked) setStatus("Saving…");
  }
  function switchDraft(id: string) { setActive(id); setUndo([]); setRedo([]); setHighlight([]); setLane("all"); setQuickIdea(""); }
  function create(template = 0) {
    if (drafts.length >= 200) { toast.error("Your library holds up to 200 drafts. Back up and remove a draft first."); return; }
    const next = newDraft(crypto.randomUUID(), template); setDrafts(prev => [next, ...prev]); switchDraft(next.id); setQuery(""); setStage(template ? "organize" : "capture"); setTemplatesOpen(false);
  }
  function addIdeas(texts: string[], section: Idea["section"] = "inbox") {
    if (doc.ideas.length + texts.length > 1000) { toast.error("Keep a draft below 1,000 idea cards. Split this into another draft."); return false; }
    update({ ideas: [...doc.ideas, ...texts.map(text => ({ id: crypto.randomUUID(), text, section, included: true, priority: "essential" as const }))] });
    return true;
  }
  function capture() {
    // Match occurrences so repeated thoughts stay visible, but re-capturing unchanged source adds nothing.
    const counts = new Map<string, number>(); doc.ideas.forEach(i => counts.set(i.text.trim(), (counts.get(i.text.trim()) ?? 0) + 1));
    const fresh = splitThoughts(doc.scratch, captureMode).filter(text => { const count = counts.get(text) ?? 0; if (count) { counts.set(text, count - 1); return false; } return true; });
    if (!fresh.length) { toast.info("These thoughts are already captured. Add a new paragraph or edit your source."); return; }
    if (addIdeas(fresh)) { setStage("organize"); setLane("inbox"); toast.success(`${fresh.length} thoughts captured. Your original writing is kept.`); }
  }
  function updateIdea(id: string, patch: Partial<Idea>) { update({ ideas: doc.ideas.map(i => i.id === id ? { ...i, ...patch } : i) }); }
  function moveIdea(id: string, direction: -1 | 1) {
    const next = [...doc.ideas]; const visibleIndex = visibleIdeas.findIndex(i => i.id === id);
    const target = visibleIdeas[visibleIndex + direction]; if (!target) return;
    const from = next.findIndex(i => i.id === id); const to = next.findIndex(i => i.id === target.id);
    if (from < 0 || to < 0) return;
    [next[from], next[to]] = [next[to], next[from]]; update({ ideas: next });
  }
  function restoreHistory(direction: "undo" | "redo") {
    const stack = direction === "undo" ? undo : redo; const previous = stack.at(-1); if (!previous) return;
    if (direction === "undo") { setUndo(undo.slice(0, -1)); setRedo(p => [...p, doc]); }
    else { setRedo(redo.slice(0, -1)); setUndo(p => [...p, doc]); }
    update(previous, false);
  }
  function snapshot() {
    if (doc.snapshots.length >= 30) { toast.error("This draft has 30 snapshots. Remove an old snapshot before adding another."); return; }
    update({ snapshots: [{ id: crypto.randomUUID(), name: snapshotName.trim() || `Version ${doc.snapshots.length + 1}`, date: Date.now(), ideas: doc.ideas, scratch: doc.scratch, role: doc.role, format: doc.format }, ...doc.snapshots] }); setSnapshotName(""); toast.success("Snapshot saved");
  }
  function inspect(ids: string[], section?: SectionId) { setHighlight(ids); setLane(section ?? "all"); setStage("organize"); setTimeout(() => document.getElementById(ids[0] ? `idea-${ids[0]}` : "idea-board")?.scrollIntoView({ block: "start", behavior: "auto" }), 100); }
  async function importBackup(file?: File) {
    if (!file) return;
    if (file.size > 10_000_000) { toast.error("Choose a backup smaller than 10 MB."); return; }
    try {
      const parsed: unknown = JSON.parse(await file.text()); if (!validDrafts(parsed)) throw Error();
      if (drafts.length + parsed.length > 200) { toast.error("Import would exceed the 200-draft library limit."); return; }
      const imported = parsed.map(d => ({ ...d, id: crypto.randomUUID(), ideas: d.ideas.map(i => ({ ...i, id: crypto.randomUUID() })), snapshots: d.snapshots.map(s => ({ ...s, id: crypto.randomUUID(), ideas: s.ideas.map(i => ({ ...i, id: crypto.randomUUID() })) })) }));
      setDrafts(p => [...imported, ...p]); switchDraft(imported[0].id); setQuery(""); toast.success("Backup imported. Existing drafts kept.");
    } catch { toast.error("This is not a valid Prompt Workbench backup. Nothing was changed."); }
  }

  const visibleIdeas = doc.ideas.filter(i => lane === "all" ? true : lane === "parked" ? !i.included : lane === "inbox" ? i.section === "inbox" && i.included : i.section === lane && i.included);
  const filename = (doc.title.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "prompt").slice(0, 100);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 sm:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div><div className="mb-3 flex items-center gap-2 text-sm text-primary"><FlaskConicalIcon className="size-4" />A little room to think</div><h1 className="flex items-center gap-4 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Prompt Workbench<FavoriteButton toolId="promptworkbench" /></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Get everything out of your head. Give each idea a place. Send one clear request.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" aria-pressed={focusMode} onClick={() => setFocusMode(p => !p)}><FocusIcon data-icon="inline-start" />{focusMode ? "Show library" : "Focus mode"}</Button><Button variant="outline" onClick={() => setTemplatesOpen(true)} disabled={!ready}><LayersIcon data-icon="inline-start" />Start from a template</Button></div>
      </header>
      {!ready && <p role="status" className="mb-4 text-sm text-muted-foreground">Opening your saved drafts…</p>}
      {savingBlocked && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 p-4"><p className="max-w-xl text-sm">Your previous library is preserved. Download its recovery file before choosing to save this new library.</p><Button variant="outline" onClick={() => download(recovery, "prompt-library-recovery.json")} disabled={!recovery}>Download recovery file</Button><Button variant="outline" onClick={() => { if (window.confirm("Replace the existing saved library with the drafts currently on screen? Download the recovery file first.")) { setSavingBlocked(false); setStatus("Saving…"); } }}>Save this library instead</Button></div>}
      <fieldset disabled={!ready} className="min-w-0">
        <div className={cn("grid items-start gap-5", !focusMode && "lg:grid-cols-[210px_minmax(0,1fr)] 2xl:grid-cols-[230px_minmax(0,1fr)]")}>
          <aside className={cn("rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-24", focusMode && "hidden")} aria-label="Prompt library">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">Your prompts</h2><Button size="icon-sm" variant="ghost" aria-label="New prompt" onClick={() => create()}><PlusIcon /></Button></div>
            <div className="mb-3"><Input aria-label="Search saved prompts" placeholder="Find a prompt…" value={query} onChange={e => setQuery(e.target.value)} /></div>
            <div className="flex max-h-52 flex-col gap-1 overflow-auto lg:max-h-[470px]">{drafts.filter(d => d.title.toLowerCase().includes(query.toLowerCase())).map(d => <button key={d.id} onClick={() => switchDraft(d.id)} className={cn("rounded-lg p-3 text-left focus-visible:outline-2 focus-visible:outline-ring", d.id === doc.id ? "bg-muted" : "hover:bg-muted/50")}><span className="block truncate text-sm font-medium">{d.title || "Untitled prompt"}</span><span className="mt-1 block text-[11px] text-muted-foreground">{d.ideas.filter(i => i.included && i.section !== "inbox").length} placed ideas · {d.snapshots.length} versions</span></button>)}{!drafts.some(d => d.title.toLowerCase().includes(query.toLowerCase())) && <p className="p-2 text-xs text-muted-foreground">No matching prompts.</p>}</div>
            <Separator className="my-4" />
            <div className="flex flex-col gap-2"><Button variant="outline" size="sm" onClick={() => download(JSON.stringify(drafts, null, 2), "prompt-workbench-library.json")}><DownloadIcon data-icon="inline-start" />Back up library</Button><Button variant="ghost" size="sm" onClick={() => fileInput.current?.click()}><UploadIcon data-icon="inline-start" />Import backup</Button></div>
            <p className="mt-4 text-[11px] leading-5 text-muted-foreground">Private, on this device. No account or AI connection. Keep a backup for other browsers.</p>
            <input ref={fileInput} className="hidden" type="file" accept=".json" aria-label="Import prompt library" onChange={e => { void importBackup(e.target.files?.[0]); e.target.value = ""; }} />
          </aside>
          <section aria-label="Prompt editing desk" className="min-w-0 rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-7">
              <div className="min-w-0 flex-1"><Input aria-label="Prompt title" value={doc.title} onChange={e => update({ title: e.target.value })} className="max-w-md" /></div>
              <div className="flex items-center gap-1"><Button variant="ghost" size="icon-sm" title="Undo" aria-label="Undo edit" disabled={!undo.length} onClick={() => restoreHistory("undo")}><Undo2Icon /></Button><Button variant="ghost" size="icon-sm" title="Redo" aria-label="Redo edit" disabled={!redo.length} onClick={() => restoreHistory("redo")}><RotateCcwIcon /></Button><Button variant="ghost" size="icon-sm" title="Duplicate prompt" aria-label="Duplicate prompt" disabled={drafts.length >= 200} onClick={() => { const next = { ...doc, id: crypto.randomUUID(), title: `${doc.title} copy` }; setDrafts(p => [next, ...p]); switchDraft(next.id); setQuery(""); }}><CopyIcon /></Button><Button variant="ghost" size="icon-sm" title="Delete prompt" aria-label="Delete prompt" onClick={() => { if (!window.confirm(`Delete “${doc.title}” and its snapshots? Back it up first if needed.`)) return; const rest = drafts.filter(d => d.id !== doc.id); const next = rest.length ? rest : [newDraft(crypto.randomUUID())]; setDrafts(next); switchDraft(next[0].id); }}><TrashIcon /></Button><Button variant="outline" size="sm" onClick={() => setVersionsOpen(true)}><SaveIcon data-icon="inline-start" />Versions</Button></div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-7"><span role="status" className="text-[11px] text-muted-foreground">{status}</span><span className="text-[11px] text-muted-foreground">{doc.ideas.length} ideas · {included.length} included · {parked.length} parked</span></div>
            <Separator />
            <Tabs value={stage} onValueChange={value => { setStage(value); setHighlight([]); }} className="gap-0">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-7"><TabsList><TabsTrigger value="capture">1. Capture</TabsTrigger><TabsTrigger value="organize">2. Organize</TabsTrigger><TabsTrigger value="review">3. Review</TabsTrigger></TabsList><span className="text-xs text-muted-foreground">Nothing is sent to an AI.</span></div>
              {focus && <div className="mx-5 mb-5 flex items-start gap-3 rounded-lg bg-primary/5 px-4 py-3 sm:mx-7"><FocusIcon className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><span className="text-[11px] font-medium text-primary">Keep this in focus</span><p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-6">{focus}</p></div></div>}
              <TabsContent value="capture" className="px-5 pb-7 sm:px-7">
                <div className="mb-5 flex flex-wrap items-center gap-3"><span className="text-xs text-muted-foreground">Turn thoughts into cards by</span><ToggleGroup.Root type="single" value={captureMode} onValueChange={v => { if (v === "paragraphs" || v === "sentences") setCaptureMode(v); }} aria-label="Thought splitting mode" className="flex rounded-lg bg-muted p-1"><ToggleGroup.Item value="paragraphs" className="rounded-md px-3 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-ring data-[state=on]:bg-background">Paragraph</ToggleGroup.Item><ToggleGroup.Item value="sentences" className="rounded-md px-3 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-ring data-[state=on]:bg-background">Sentence</ToggleGroup.Item></ToggleGroup.Root><span className="text-[11px] text-muted-foreground">Sentence mode helps with one long block of text.</span></div>
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_270px]">
                  <div>
                    <h2 className="font-heading text-2xl font-medium tracking-tight">Think freely. Sort it later.</h2>
                    <p className="mt-2 mb-5 text-sm leading-6 text-muted-foreground">Write or paste your messy prompt. Leave a blank line between thoughts to turn them into separate cards.</p>
                    <Field label="Brain dump" htmlFor="brain-dump">
                      <Textarea id="brain-dump" value={doc.scratch} onChange={e => update({ scratch: e.target.value })} placeholder={"I want to build something…\n\nAlso, it needs to…\n\nAnd one more thing…"} className="min-h-[380px] resize-y" />
                    </Field>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">{doc.scratch.length} characters · Original writing always kept</span>
                      <Button disabled={!doc.scratch.trim()} onClick={capture}><InboxIcon data-icon="inline-start" />Capture thoughts<ArrowRightIcon data-icon="inline-end" /></Button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-5"><div className="rounded-xl bg-muted/40 p-5"><CircleHelpIcon className="mb-3 size-5 text-primary" /><h3 className="text-sm font-semibold">You don’t have to get it right yet.</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Capture half-formed ideas, reminders and details. We’ll give them structure in the next step.</p></div><div className="rounded-xl border border-border p-5"><h3 className="text-sm font-semibold">Just want to explore?</h3><p className="my-3 text-xs leading-5 text-muted-foreground">Try a messy sample and see how ideas become a focused brief.</p><Button variant="outline" size="sm" onClick={() => update({ scratch: doc.scratch ? `${doc.scratch}\n\n${SAMPLE}` : SAMPLE })}>Add sample thoughts</Button></div><div className="px-1"><h3 className="mb-3 text-sm font-semibold">The shape of a clear prompt</h3><div className="flex flex-col gap-3">{SECTIONS.map(s => <div key={s.id} className="flex items-center gap-2 text-xs text-muted-foreground"><span className={cn("size-1.5 rounded-full", included.some(i => i.section === s.id) ? "bg-primary" : "bg-border")} />{s.label}</div>)}</div></div></div>
                </div>
              </TabsContent>
              <TabsContent value="organize" className="px-5 pb-7 sm:px-7">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-heading text-2xl font-medium tracking-tight">Give each thought a home.</h2><p className="mt-2 text-sm text-muted-foreground">Place, refine and prioritize. Park anything that can wait.</p></div><Button variant="outline" disabled={!inbox.length} onClick={() => { update({ ideas: doc.ideas.map(i => i.section === "inbox" && i.included && i.text.trim() ? { ...i, section: suggestSection(i.text).section } : i) }); setLane("all"); toast.success("Keyword suggestions applied. Review each placement; undo is available."); }}><SparklesIcon data-icon="inline-start" />Suggest all placements</Button></div>
                <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><Textarea aria-label="Quick idea" value={quickIdea} onChange={e => setQuickIdea(e.target.value)} placeholder="Remembered something? Drop it in the inbox." className="min-h-16" onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && quickIdea.trim()) { e.preventDefault(); if (addIdeas([quickIdea.trim()])) { setQuickIdea(""); setLane("inbox"); } } }} /><Button className="self-end" disabled={!quickIdea.trim()} onClick={() => { if (addIdeas([quickIdea.trim()])) { setQuickIdea(""); setLane("inbox"); } }}><PlusIcon data-icon="inline-start" />Add idea</Button></div>
                <div className="grid gap-5 xl:grid-cols-[180px_minmax(0,1fr)]">
                  <nav aria-label="Idea sections" className="flex flex-wrap content-start gap-1 xl:sticky xl:top-24 xl:self-start xl:flex-col">{[{ id: "all", label: "All ideas", count: doc.ideas.length }, { id: "inbox", label: "Idea inbox", count: inbox.length }, ...SECTIONS.map(s => ({ id: s.id, label: s.label, count: included.filter(i => i.section === s.id).length })), { id: "parked", label: "Parked for later", count: parked.length }].map(s => <button key={s.id} aria-current={lane === s.id ? "true" : undefined} onClick={() => { setLane(s.id); setHighlight([]); }} className={cn("flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs focus-visible:outline-2 focus-visible:outline-ring", lane === s.id ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:bg-muted/40")}><span>{s.label}</span><span className="text-[10px] opacity-60">{s.count}</span></button>)}</nav>
                  <div id="idea-board" className="min-w-0 scroll-mt-28"><div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{SECTIONS.find(s => s.id === lane)?.hint ?? (lane === "inbox" ? "Inbox ideas stay out of the final prompt until placed." : lane === "parked" ? "Saved here, left out of the final prompt." : "Card order is kept within each section of your final prompt.")}</p><Button variant="ghost" size="sm" disabled={doc.ideas.length >= 1000} onClick={() => addIdeas([""], SECTIONS.some(s => s.id === lane) ? lane as SectionId : "inbox")}><PlusIcon data-icon="inline-start" />New card</Button></div><div className="flex flex-col gap-3">{visibleIdeas.map((idea, visibleIndex) => { const index = doc.ideas.findIndex(i => i.id === idea.id); return <IdeaCard key={idea.id} idea={idea} index={index} first={visibleIndex === 0} last={visibleIndex === visibleIdeas.length - 1} highlight={highlight.includes(idea.id)} onUpdate={patch => updateIdea(idea.id, patch)} onMove={direction => moveIdea(idea.id, direction)} onDelete={() => { update({ ideas: doc.ideas.filter(i => i.id !== idea.id) }); toast.info("Idea removed. Use Undo to restore it."); }} />; })}{!visibleIdeas.length && <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center"><InboxIcon className="mb-3 size-7 text-muted-foreground/60" /><h3 className="text-sm font-medium">{SECTIONS.find(s => s.id === lane)?.question ?? "A little space for your next idea."}</h3><p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">Add a card here, capture a brain dump, or move an existing idea into this section.</p></div>}</div></div>
                </div>
                <div className="mt-5 flex justify-end"><Button onClick={() => setStage("review")}>Review your prompt<ArrowRightIcon data-icon="inline-end" /></Button></div>
              </TabsContent>
              <TabsContent value="review" className="px-5 pb-7 sm:px-7">
                <div className="mb-4 flex justify-end"><Button variant="outline" size="sm" disabled={!doc.snapshots.length} onClick={() => setCompareOpen(true)}><LayersIcon data-icon="inline-start" />Compare versions</Button></div>
                <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
                  <div className="min-w-0"><div className="mb-5"><h2 className="font-heading text-2xl font-medium tracking-tight">One clear request.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Your included ideas, in a deliberate order. Inbox and parked ideas stay on your desk.</p></div><Field label="AI role" htmlFor="prompt-role" optional hint="Use a relevant perspective, or leave it blank."><Input id="prompt-role" placeholder="e.g. Act as a careful product designer." value={doc.role} onChange={e => update({ role: e.target.value })} /></Field><div className="my-4 flex flex-wrap items-center justify-between gap-3"><Select value={doc.format} onValueChange={format => update({ format: format as PromptFormat })}><SelectTrigger aria-label="Prompt format" className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="markdown">Markdown headings</SelectItem><SelectItem value="plain">Plain text</SelectItem><SelectItem value="xml">XML sections</SelectItem></SelectGroup></SelectContent></Select><span className="text-xs text-muted-foreground">{words} words · {finalPrompt.length} characters</span></div><div className="rounded-xl border border-border bg-background p-5 sm:p-7"><pre aria-label="Assembled prompt" className="min-h-72 whitespace-pre-wrap break-words font-sans text-sm leading-7">{finalPrompt || "Place your ideas into sections to assemble your prompt here."}</pre></div><div className="mt-4 flex flex-wrap gap-2"><CopyButton text={finalPrompt} disabled={!finalPrompt} label="Copy final prompt" successMessage="Prompt copied. Ready for your AI chat." /><Button variant="outline" disabled={!finalPrompt} onClick={() => download(finalPrompt, `${filename}.${doc.format === "markdown" ? "md" : doc.format === "xml" ? "xml" : "txt"}`, "text/plain;charset=utf-8")}><DownloadIcon data-icon="inline-start" />Download prompt</Button><Button variant="ghost" onClick={() => setVersionsOpen(true)}><SaveIcon data-icon="inline-start" />Save a version</Button></div></div>
                  <aside className="flex min-w-0 flex-col gap-4" aria-label="Prompt review"><div className="rounded-xl bg-muted/40 p-5"><div className="flex items-center gap-2"><SearchIcon className="size-4 text-primary" /><h3 className="text-sm font-semibold">A second look</h3></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Local wording checks, not an AI quality score. Suggestions need your judgment.</p><div className="mt-4 flex flex-wrap gap-1.5">{SECTIONS.map(s => <Badge key={s.id} variant={coverage.some(c => c.id === s.id) ? "secondary" : "outline"}>{coverage.some(c => c.id === s.id) && <CheckIcon />}{s.label}</Badge>)}</div></div>
                    <div className="rounded-xl border border-border p-5"><h3 className="text-sm font-semibold">Before you send</h3><div className="mt-4 flex flex-col gap-4">{findings.map((f, i) => <div key={i}><p className="text-xs font-semibold">{f.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{f.detail}</p>{(f.section || f.ideaIds) && <Button className="mt-2" variant="outline" size="sm" onClick={() => inspect(f.ideaIds ?? [], f.section)}>Review ideas</Button>}</div>)}{!findings.length && <p className="text-xs leading-5 text-muted-foreground">The basic structure is present. Read your final prompt once to confirm it says exactly what you mean.</p>}</div></div>
                    <div className="rounded-xl border border-border p-5"><h3 className="text-sm font-semibold">Repetition radar</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">Exact matches and strong word overlap among included cards. Compare before removing anything.</p><div className="mt-4 flex flex-col gap-4">{repeats.map(pair => <div key={`${pair.a.id}-${pair.b.id}`}><Badge variant="secondary">{pair.exact ? "Same wording" : "Possible overlap"}</Badge><p className="mt-2 line-clamp-3 text-xs leading-5">{pair.a.text}</p><p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{pair.b.text}</p><div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => inspect([pair.a.id, pair.b.id])}>Compare</Button>{pair.exact && <Button variant="ghost" size="sm" onClick={() => { updateIdea(pair.b.id, { included: false }); toast.info("Repeated idea parked. Restore it anytime."); }}><ArchiveIcon data-icon="inline-start" />Park repeat</Button>}</div></div>)}{!repeats.length && <p className="text-xs text-muted-foreground">No strong card-level repetition found.</p>}</div></div>
                    {echoes.length > 0 && <div className="rounded-xl border border-border p-5"><h3 className="text-sm font-semibold">Sentence echoes</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">Repeated sentences, including inside long cards.</p><div className="mt-3 flex flex-col gap-4">{echoes.map(e => <div key={e.text}><Badge variant="secondary">Repeated {e.count} times</Badge><p className="mt-2 line-clamp-4 text-xs leading-5">{e.text}</p><Button variant="outline" size="sm" className="mt-2" onClick={() => inspect(e.ids)}>Edit repetition</Button></div>)}</div></div>}
                    {included.length > 150 && <p className="text-xs leading-5 text-muted-foreground">Repetition checks cover the first 150 included cards. Consider splitting this brief into smaller prompts.</p>}
                    {doc.ideas.some(i => /\[[^\]\n]+\]/.test(i.text) && i.included && i.section !== "inbox") && <p className="rounded-lg bg-muted/40 p-4 text-xs leading-5 text-muted-foreground">Bracketed text found. If it’s a template placeholder, replace it before sending.</p>}
                  </aside>
                </div>
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </fieldset>
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>See what changed</DialogTitle><DialogDescription>Read your saved version beside the current prompt. Comparing does not change your draft.</DialogDescription></DialogHeader>{compared && <><Select value={compared.id} onValueChange={setComparedId}><SelectTrigger aria-label="Version to compare" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{doc.snapshots.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectGroup></SelectContent></Select><div className="grid gap-4 md:grid-cols-2"><div><h3 className="mb-2 text-xs font-semibold">Saved: {compared.name}</h3><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-4 font-sans text-xs leading-6">{assemblePrompt(compared) || "No placed ideas in this version."}</pre></div><div><h3 className="mb-2 text-xs font-semibold">Current draft</h3><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-4 font-sans text-xs leading-6">{finalPrompt || "No placed ideas in your current draft."}</pre></div></div></>}</DialogContent></Dialog>
      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>A starting point for your thoughts</DialogTitle><DialogDescription>Each template creates a new draft. Replace the bracketed details with your own.</DialogDescription></DialogHeader><div className="grid gap-2 sm:grid-cols-2">{TEMPLATE_DATA.map((t, i) => <button key={t.name} onClick={() => create(i)} className="rounded-lg border border-border p-4 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><p className="text-sm font-semibold">{t.name}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t.description}</p></button>)}</div></DialogContent></Dialog>
      <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Room to experiment</DialogTitle><DialogDescription>Save a named snapshot before changing direction. Restoring a version can be undone.</DialogDescription></DialogHeader><div className="flex gap-2"><Input aria-label="Version name" placeholder="e.g. Shorter, more focused" value={snapshotName} onChange={e => setSnapshotName(e.target.value)} /><Button onClick={snapshot}><SaveIcon data-icon="inline-start" />Save</Button></div><div className="flex max-h-80 flex-col gap-2 overflow-auto">{doc.snapshots.map(s => <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{s.name}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(s.date).toLocaleString()} · {s.ideas.length} ideas</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => { update({ ideas: s.ideas, scratch: s.scratch, role: s.role, format: s.format }); setVersionsOpen(false); toast.success("Version restored. Undo is available."); }}>Restore</Button><Button variant="ghost" size="icon-sm" aria-label={`Delete version ${s.name}`} onClick={() => { update({ snapshots: doc.snapshots.filter(v => v.id !== s.id) }); toast.info("Snapshot removed. Undo is available."); }}><TrashIcon /></Button></div></div>)}{!doc.snapshots.length && <p className="py-5 text-sm text-muted-foreground">No snapshots yet. Save this draft when you want a point to return to.</p>}</div></DialogContent></Dialog>
    </div>
  );
}

const SAMPLE = "Create a landing page for my small architecture studio.\n\nMy audience is homeowners planning their first renovation. We focus on calm spaces and natural materials.\n\nThe page must include selected projects, our process and a contact form.\n\nIt should look professional and creative.\n\nThe page must include selected projects, our process and a contact form.\n\nReturn a responsive implementation with a short explanation of the design choices.\n\nAvoid stock photos and auto-playing animations.\n\nFor example, I like the generous spacing and restrained typography of gallery websites.";
