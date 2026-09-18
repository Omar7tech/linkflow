"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { renderToStaticMarkup } from "react-dom/server";
import { BoldIcon, ItalicIcon, CodeIcon, LinkIcon, ListIcon, HeadingIcon, PlusIcon, CopyIcon, TrashIcon, UploadIcon, DownloadIcon, FileTextIcon, CheckSquareIcon, TableIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import { cn } from "@/lib/utils";

type Doc = { id: string; title: string; folder: string; content: string; updated: number };
const KEY = "tm-markdown-documents-v1";
const TEMPLATES = {
  Welcome: "# A place for your ideas\n\nWrite in **Markdown**, see it take shape beside you. Your documents save automatically in this browser.\n\n## Make something useful\n\n- [x] Open your writing studio\n- [ ] Try the formatting toolbar\n- [ ] Export your first document\n\n> Small notes become great ideas. Give them a home.\n\n## A little structure\n\n| Feature | Ready |\n| --- | --- |\n| Live preview | Yes |\n| Local autosave | Yes |\n| Markdown & HTML export | Yes |\n\n```js\nconst idea = 'Start here';\nconsole.log(idea);\n```\n",
  Blank: "",
  README: "# Project name\n\nA short description of what your project does.\n\n## Getting started\n\n```bash\nnpm install\nnpm run dev\n```\n\n## Features\n\n- Your first feature\n- Your second feature\n\n## Usage\n\nExplain how to use your project.\n\n## License\n\nMIT\n",
  "Meeting notes": "# Meeting notes\n\n**Date:** YYYY-MM-DD\n**Attendees:** Add names\n\n## Agenda\n\n1. First topic\n2. Second topic\n\n## Decisions\n\n- What did we decide?\n\n## Action items\n\n- [ ] Task — owner — due date\n\n## Next meeting\n\nAdd a date and topics.\n",
  "Project brief": "# Project brief\n\n## The goal\n\nWhat are we trying to achieve?\n\n## Audience\n\nWho is this for?\n\n## Deliverables\n\n| Deliverable | Owner | Due |\n| --- | --- | --- |\n| First milestone | Team | TBD |\n\n## Success looks like\n\n- A measurable outcome\n\n## Open questions\n\n- [ ] What do we need to clarify?\n",
};
const first: Doc = { id: "welcome", title: "Your first document", folder: "Personal", content: TEMPLATES.Welcome, updated: 0 };
const previewClass = "break-words leading-7 text-foreground [&_h1]:mb-6 [&_h1]:text-4xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_h4]:mt-5 [&_h4]:font-semibold [&_h5]:font-semibold [&_h6]:font-semibold [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-5 [&_blockquote]:text-muted-foreground [&_a]:text-primary [&_a]:underline [&_pre]:my-5 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:text-sm [&_table]:my-5 [&_table]:block [&_table]:overflow-auto [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-4 [&_th]:py-2 [&_td]:border [&_td]:border-border [&_td]:px-4 [&_td]:py-2 [&_img]:max-w-full [&_img]:rounded-lg [&_hr]:my-8 [&_hr]:border-border [&_input]:mr-2";
const exportStyle = "body{font:16px/1.7 system-ui,sans-serif;color:#202027;max-width:800px;margin:48px auto;padding:0 24px}h1,h2,h3{line-height:1.2}h1{font-size:36px}h2{margin-top:32px}a{color:#8c2397}pre,code{background:#f3f3f6;border-radius:6px}pre{padding:18px;overflow:auto}code{font-size:14px}blockquote{border-left:4px solid #b141be;padding-left:20px;color:#666}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:10px;text-align:left}th{background:#f5f5f7}img{max-width:100%}input{margin-right:8px}@media print{body{margin:0;max-width:none}pre{white-space:pre-wrap}h1,h2,h3{break-after:avoid}img,tr{break-inside:avoid}}";

function validDocs(value: unknown): value is Doc[] {
  return Array.isArray(value) && value.length > 0 && value.every(d => d && typeof d.id === "string" && typeof d.title === "string" && typeof d.folder === "string" && typeof d.content === "string" && typeof d.updated === "number");
}
function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function MarkdownTool() {
  const [docs, setDocs] = useState<Doc[]>([first]);
  const [active, setActive] = useState(first.id);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Loading library…");
  const [query, setQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState("All");
  const [view, setView] = useState("split");
  const [serif, setSerif] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const doc = docs.find(d => d.id === active) ?? docs[0];

  useEffect(() => {
    const timer = setTimeout(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const parsed: unknown = JSON.parse(raw); if (!validDocs(parsed)) throw Error(); setDocs(parsed); setActive(parsed[0].id); }
      setStatus("Saved in this browser");
    } catch { setStatus("Library could not load. Export a backup before closing."); }
    setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(docs)); setStatus("Saved in this browser"); }
      catch { setStatus("Could not save. Download a backup to keep your work."); }
    }, 400);
    return () => clearTimeout(timer);
  }, [docs, ready]);

  function update(patch: Partial<Doc>) {
    setStatus("Saving…");
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, ...patch, updated: Date.now() } : d));
  }
  function create(template: keyof typeof TEMPLATES = "Blank") {
    const next: Doc = { id: crypto.randomUUID(), title: template === "Blank" ? "Untitled document" : template, folder: "Personal", content: TEMPLATES[template], updated: Date.now() };
    setDocs(prev => [next, ...prev]); setActive(next.id); setQuery(""); setFolderFilter("All");
  }
  function insert(before: string, after = "", placeholder = "text") {
    const element = editor.current;
    const start = element?.selectionStart ?? doc.content.length, end = element?.selectionEnd ?? start;
    const selection = doc.content.slice(start, end) || placeholder;
    update({ content: doc.content.slice(0, start) + before + selection + after + doc.content.slice(end) });
    if (view === "preview") setView("split");
    requestAnimationFrame(() => { editor.current?.focus(); editor.current?.setSelectionRange(start + before.length, start + before.length + selection.length); });
  }
  const headings = [...doc.content.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, "").matchAll(/^(#{1,6})\s+(.+)$/gm)].map(m => ({ level: m[1].length, text: m[2].replace(/[*`_]/g, "") }));
  const words = doc.content.trim().split(/\s+/).filter(Boolean).length;
  const filename = (doc.title.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "document").slice(0, 100);
  function html() {
    const title = doc.title.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${exportStyle}</style></head><body>${renderToStaticMarkup(<Markdown remarkPlugins={[remarkGfm]} skipHtml>{doc.content}</Markdown>)}</body></html>`;
  }
  function print() {
    const popup = window.open("", "_blank");
    if (!popup) { toast.error("Allow popups to open the print preview."); return; }
    popup.document.write(html()); popup.document.close(); popup.opener = null;
    let printed = false;
    const showPrint = () => { if (printed) return; printed = true; popup.focus(); popup.print(); };
    popup.onload = showPrint;
    setTimeout(() => { if (!popup.closed && popup.document.readyState === "complete") showPrint(); }, 500);
  }
  async function importFile(file?: File) {
    if (!file) return;
    if (file.size > 5_000_000) { toast.error("Choose a file smaller than 5 MB."); return; }
    try {
      const text = await file.text();
      if (file.name.endsWith(".json")) {
        const value: unknown = JSON.parse(text); if (!validDocs(value)) throw Error("Invalid library backup");
        const restored = value.map(d => ({ ...d, id: crypto.randomUUID() })); setDocs(prev => [...restored, ...prev]); setActive(restored[0].id);
      } else {
        const next: Doc = { id: crypto.randomUUID(), title: file.name.replace(/\.(md|markdown|txt)$/i, ""), folder: "Imported", content: text, updated: Date.now() };
        setDocs(prev => [next, ...prev]); setActive(next.id);
      }
      setQuery(""); setFolderFilter("All"); toast.success("Imported into your library");
    } catch { toast.error("Could not import this file. Use Markdown or a valid library backup."); }
  }

  return (
    <GeneratorLayout tool={TOOL_BY_ID.markdown} output={null} fullBleed>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-medium"><FileTextIcon className="size-4 text-primary" />Your writing desk <span className="text-xs font-normal text-muted-foreground" role="status">{status}</span></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => importRef.current?.click()}><UploadIcon />Import</Button>
            <Button variant="outline" onClick={() => download(JSON.stringify(docs, null, 2), "markdown-library.json", "application/json")}><DownloadIcon />Back up library</Button>
            <Select onValueChange={value => create(value as keyof typeof TEMPLATES)} value=""><SelectTrigger className="w-40"><SelectValue placeholder="Start a template" /></SelectTrigger><SelectContent>{Object.keys(TEMPLATES).filter(t => t !== "Welcome").map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
          </div>
          <input ref={importRef} type="file" accept=".md,.markdown,.txt,.json" className="hidden" aria-label="Import Markdown or library backup" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        <div className="grid lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-3 border-b border-border bg-muted/30 p-4 lg:border-r lg:border-b-0" aria-label="Document library">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Your documents</h2><Button size="icon-sm" variant="ghost" aria-label="New document" onClick={() => create()}><PlusIcon /></Button></div>
            <Input placeholder="Search documents…" aria-label="Search documents" value={query} onChange={e => setQuery(e.target.value)} />
            <Select value={folderFilter} onValueChange={setFolderFilter}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["All", ...new Set(docs.map(d => d.folder || "Unfiled"))].map(f => <SelectItem key={f} value={f}>{f === "All" ? "All folders" : f}</SelectItem>)}</SelectContent></Select>
            <div className="flex max-h-48 flex-col gap-1 overflow-auto lg:max-h-[590px]">
              {docs.filter(d => (folderFilter === "All" || (d.folder || "Unfiled") === folderFilter) && `${d.title} ${d.content}`.toLowerCase().includes(query.toLowerCase())).map(d => <button key={d.id} onClick={() => setActive(d.id)} className={cn("rounded-lg p-3 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring", d.id === doc.id && "bg-background ring-1 ring-border")}><span className="block truncate text-sm font-medium">{d.title || "Untitled"}</span><span className="mt-1 block text-[11px] text-muted-foreground">{d.folder || "Unfiled"} · {d.content.length} characters</span></button>)}
              {!docs.some(d => (folderFilter === "All" || (d.folder || "Unfiled") === folderFilter) && `${d.title} ${d.content}`.toLowerCase().includes(query.toLowerCase())) && <p className="p-3 text-xs text-muted-foreground">No documents match your search.</p>}
            </div>
            <p className="mt-auto pt-4 text-xs leading-5 text-muted-foreground">Stored on this device, in this browser. Download a library backup to keep a portable copy.</p>
          </aside>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
              <Input aria-label="Document title" className="min-w-40 flex-1" value={doc.title} onChange={e => update({ title: e.target.value })} />
              <Input aria-label="Document folder" placeholder="Folder" className="w-32" value={doc.folder} onChange={e => update({ folder: e.target.value })} />
              <Button size="icon" variant="ghost" aria-label="Duplicate document" onClick={() => { const next = { ...doc, id: crypto.randomUUID(), title: `${doc.title} copy` }; setDocs(p => [next, ...p]); setActive(next.id); }}><CopyIcon /></Button>
              <Button size="icon" variant="ghost" aria-label="Delete document" onClick={() => { if (!window.confirm(`Delete “${doc.title}”? Export it first if you need a copy.`)) return; const remaining = docs.filter(d => d.id !== doc.id); const next = remaining.length ? remaining : [{ ...first, id: crypto.randomUUID(), content: "", title: "Untitled document" }]; setDocs(next); setActive(next[0].id); }}><TrashIcon /></Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex flex-wrap gap-1">{[
                { name: "Heading", icon: HeadingIcon, before: "\n## ", after: "\n", text: "Heading" },
                { name: "Bold", icon: BoldIcon, before: "**", after: "**", text: "bold text" },
                { name: "Italic", icon: ItalicIcon, before: "_", after: "_", text: "italic text" },
                { name: "Link", icon: LinkIcon, before: "[", after: "](https://example.com)", text: "link text" },
                { name: "Code block", icon: CodeIcon, before: "\n```\n", after: "\n```\n", text: "your code" },
                { name: "List", icon: ListIcon, before: "\n- ", after: "\n", text: "List item" },
                { name: "Checklist", icon: CheckSquareIcon, before: "\n- [ ] ", after: "\n", text: "Task" },
                { name: "Table", icon: TableIcon, before: "\n", after: "\n", text: "| Column | Column |\n| --- | --- |\n| Value | Value |" },
              ].map(item => <Button key={item.name} size="icon-sm" variant="ghost" title={item.name} aria-label={`Insert ${item.name.toLowerCase()}`} onClick={() => insert(item.before, item.after, item.text)}><item.icon /></Button>)}</div>
              <Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="write">Write</TabsTrigger><TabsTrigger value="split">Split</TabsTrigger><TabsTrigger value="preview">Read</TabsTrigger></TabsList></Tabs>
            </div>
            <div className={cn("grid min-h-[570px]", view === "split" && "xl:grid-cols-2")}>
              {view !== "preview" && <div className="flex min-w-0 flex-col border-b border-border xl:border-r xl:border-b-0"><div className="flex items-center justify-between px-5 py-3 text-xs text-muted-foreground"><span>Markdown source</span><span>⌘ / Ctrl + B or I</span></div><textarea ref={editor} value={doc.content} aria-label="Markdown source" spellCheck className="min-h-[500px] w-full flex-1 resize-y bg-transparent px-5 pb-5 font-mono text-sm leading-7 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onChange={e => update({ content: e.target.value })} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && ["b", "i"].includes(e.key.toLowerCase())) { e.preventDefault(); const bold = e.key.toLowerCase() === "b"; insert(bold ? "**" : "_", bold ? "**" : "_"); } if (e.key === "Tab") { e.preventDefault(); insert("", "", "  "); } }} placeholder="# Your next idea starts here" /></div>}
              {view !== "write" && <div className="min-w-0"><div className="flex items-center justify-between border-b border-border/50 px-5 py-3 text-xs text-muted-foreground"><span>Live preview</span><Button size="sm" variant="ghost" onClick={() => setSerif(p => !p)}>{serif ? "Sans type" : "Serif type"}</Button></div><div ref={preview} className={cn("max-h-[650px] overflow-auto px-6 py-8 sm:px-10", serif && "font-serif")}><article className={previewClass}><Markdown remarkPlugins={[remarkGfm]} skipHtml>{doc.content}</Markdown>{!doc.content && <p className="text-muted-foreground">Your document will appear here as you write.</p>}</article></div></div>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3"><span className="text-xs text-muted-foreground">{words} words · {doc.content.length} characters · {Math.max(1, Math.ceil(words / 200))} min read</span><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => download(doc.content, `${filename}.md`, "text/markdown;charset=utf-8")}>Download .md</Button><Button variant="outline" onClick={() => download(html(), `${filename}.html`, "text/html;charset=utf-8")}>Export HTML</Button><Button onClick={print}>Print / PDF</Button></div></div>
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-2"><div className="rounded-xl border border-border p-5"><h2 className="text-sm font-semibold">Document outline</h2><div className="mt-3 flex flex-col gap-2">{headings.length ? headings.map((h, i) => <button key={i} className="text-left text-sm text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-ring" style={{ paddingLeft: (h.level - 1) * 12 }} onClick={() => { if (view === "write") setView("split"); requestAnimationFrame(() => preview.current?.querySelectorAll("h1,h2,h3,h4,h5,h6")[i]?.scrollIntoView({ block: "center", behavior: "smooth" })); }}>{h.text}</button>) : <p className="text-sm text-muted-foreground">Add a heading with # to build your outline.</p>}</div></div><div className="rounded-xl border border-border p-5"><h2 className="text-sm font-semibold">A few shortcuts</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">Select text and use the toolbar to format it. Start headings with #, make a checklist with - [ ], and wrap code in triple backticks. Tables, strikethrough, links and footnotes are supported. Raw HTML is omitted from preview and export.</p></div></div>
    </GeneratorLayout>
  );
}
