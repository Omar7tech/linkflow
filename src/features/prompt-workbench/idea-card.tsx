"use client";

import { ArrowDownIcon, ArrowUpIcon, ArchiveIcon, Undo2Icon, TrashIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SECTIONS, suggestSection, type Idea, type Priority, type SectionId } from "@/lib/prompt-workbench";

type Props = {
  idea: Idea; index: number; highlight?: boolean; first: boolean; last: boolean;
  onUpdate: (patch: Partial<Idea>) => void; onMove: (direction: -1 | 1) => void; onDelete: () => void;
};

export function IdeaCard({ idea, index, highlight, first, last, onUpdate, onMove, onDelete }: Props) {
  const suggestion = suggestSection(idea.text);
  return (
    <article id={`idea-${idea.id}`} className={cn("scroll-mt-28 rounded-xl border border-border bg-background p-4 transition-colors", !idea.included && "bg-muted/40", highlight && "ring-2 ring-primary")}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Idea {index + 1}</span>{!idea.included && <Badge variant="secondary">Parked</Badge>}</div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-xs" aria-label={`Move idea ${index + 1} up`} disabled={first} onClick={() => onMove(-1)}><ArrowUpIcon /></Button>
          <Button variant="ghost" size="icon-xs" aria-label={`Move idea ${index + 1} down`} disabled={last} onClick={() => onMove(1)}><ArrowDownIcon /></Button>
          <Button variant="ghost" size="icon-xs" title={idea.included ? "Park for later" : "Include again"} aria-label={`${idea.included ? "Park" : "Include"} idea ${index + 1}`} onClick={() => onUpdate({ included: !idea.included })}>{idea.included ? <ArchiveIcon /> : <Undo2Icon />}</Button>
          <Button variant="ghost" size="icon-xs" aria-label={`Delete idea ${index + 1}`} onClick={onDelete}><TrashIcon /></Button>
        </div>
      </div>
      <Textarea aria-label={`Idea ${index + 1} text`} value={idea.text} onChange={e => onUpdate({ text: e.target.value })} className="min-h-24 resize-y" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select value={idea.section} onValueChange={value => onUpdate({ section: value as SectionId | "inbox" })}>
          <SelectTrigger aria-label={`Section for idea ${index + 1}`} className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup><SelectItem value="inbox">Idea inbox</SelectItem>{SECTIONS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectGroup></SelectContent>
        </Select>
        <Select value={idea.priority} onValueChange={value => onUpdate({ priority: value as Priority })}>
          <SelectTrigger aria-label={`Priority for idea ${index + 1}`} className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup><SelectItem value="essential">Essential</SelectItem><SelectItem value="preference">Nice-to-have</SelectItem></SelectGroup></SelectContent>
        </Select>
      </div>
      {idea.section === "inbox" && <div className="mt-3 flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" disabled={!idea.text.trim()} onClick={() => onUpdate({ section: suggestion.section })}><CheckIcon data-icon="inline-start" />Place in {SECTIONS.find(s => s.id === suggestion.section)?.label}</Button><p className="text-[11px] leading-5 text-muted-foreground">{suggestion.reason}</p></div>}
    </article>
  );
}
