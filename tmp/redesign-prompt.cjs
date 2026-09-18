const fs = require('fs');
const p = 'src/features/prompt-workbench/prompt-workbench-tool.tsx';
let s = fs.readFileSync(p, 'utf8');
const start = s.indexOf('  return (\n    <div className="mx-auto');
const end = s.indexOf('\nconst SAMPLE');
if (start < 0 || end < 0) throw Error('Could not locate UI');
const ui = fs.readFileSync('tmp/prompt-ui.txt', 'utf8');
s = s.slice(0,start) + ui + s.slice(end);
s = s.replace('import { ToggleGroup } from "radix-ui";', 'import Link from "next/link";');
s = s.replace(/import \{ ArchiveIcon[^\n]+/, 'import { ArrowLeftIcon, CheckIcon, DownloadIcon, FlaskConicalIcon, LayersIcon, MoreHorizontalIcon, PlusIcon, SaveIcon, SparklesIcon, TrashIcon, Undo2Icon, UploadIcon, RotateCcwIcon } from "lucide-react";');
s = s.replace('import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";', 'import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";');
s = s.replace('import { Badge } from "@/components/ui/badge";\n','').replace('import { Separator } from "@/components/ui/separator";\n','').replace('import { Field } from "@/components/shared/field";\n','').replace('import { FavoriteButton } from "@/components/shared/favorite-button";\n','');
s = s.replace('  const [quickIdea, setQuickIdea] = useState("");\n', '').replace('  const [captureMode, setCaptureMode] = useState<"paragraphs" | "sentences">("paragraphs");\n','').replace('  const [focusMode, setFocusMode] = useState(false);','  const [libraryOpen, setLibraryOpen] = useState(false);\n  const [checksOpen, setChecksOpen] = useState(false);\n  const [settingsOpen, setSettingsOpen] = useState(false);\n  const [ideasOpen, setIdeasOpen] = useState(false);\n  const [mobilePreview, setMobilePreview] = useState(false);');
s = s.replace('  const coverage = SECTIONS.filter(s => included.some(i => i.section === s.id));\n','').replace('  const focus = included.find(i => i.section === "goal")?.text;\n','');
s = s.replace(' setQuickIdea("");','');
const cstart = s.indexOf('  function capture() {');
const cend = s.indexOf('  function updateIdea',cstart);
s = s.slice(0,cstart) + `  function capture() {
    const counts = new Map<string, number>();
    doc.ideas.forEach(i => counts.set(i.text.trim(), (counts.get(i.text.trim()) ?? 0) + 1));
    const fresh = splitThoughts(doc.scratch, "sentences").filter(text => {
      const count = counts.get(text) ?? 0;
      if (count) { counts.set(text, count - 1); return false; }
      return true;
    });
    if (doc.ideas.length + fresh.length > 1000) { toast.error("Split this into a smaller prompt first."); return; }
    const ideas = [...doc.ideas.map(i => i.section === "inbox" && i.included ? { ...i, section: suggestSection(i.text).section } : i),
      ...fresh.map(text => ({ id: crypto.randomUUID(), text, section: suggestSection(text).section, included: true, priority: "essential" as const }))];
    if (fresh.length || inbox.length) update({ ideas });
    setStage("organize"); setMobilePreview(false);
    toast.success("Your thoughts are organized. Edit any section to make it yours.");
  }
` + s.slice(cend);
const istart=s.indexOf('  function inspect('); const iend=s.indexOf('  async function importBackup',istart);
s=s.slice(0,istart)+`  function inspect(ids: string[], section?: SectionId) { setHighlight(ids); setLane(section ?? "all"); setChecksOpen(false); setIdeasOpen(true); }
`+s.slice(iend);
fs.writeFileSync(p,s);
