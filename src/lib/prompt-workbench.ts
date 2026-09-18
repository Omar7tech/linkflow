export const SECTIONS = [
  { id: "goal", label: "Goal", question: "What is the one thing you want the AI to accomplish?", hint: "Start with a clear action and outcome." },
  { id: "context", label: "Context", question: "What background will help the AI understand this?", hint: "Audience, existing work, relevant facts and source material." },
  { id: "requirements", label: "Requirements", question: "What must the result do or include?", hint: "Separate essentials from nice-to-haves." },
  { id: "output", label: "Expected output", question: "What should the answer look like?", hint: "Format, length, tone and what a successful answer contains." },
  { id: "examples", label: "Examples & references", question: "Is there a sample or reference worth following?", hint: "Keep examples distinct from instructions." },
  { id: "avoid", label: "Things to avoid", question: "What should the AI leave out or keep unchanged?", hint: "Boundaries, exclusions and common mistakes." },
] as const;
export type SectionId = (typeof SECTIONS)[number]["id"];
export type Priority = "essential" | "preference";
export type PromptFormat = "markdown" | "plain" | "xml";
export type Idea = { id: string; text: string; section: SectionId | "inbox"; priority: Priority; included: boolean };
export type Snapshot = { id: string; name: string; date: number; ideas: Idea[]; scratch: string; role: string; format: PromptFormat };
export type PromptDraft = { id: string; title: string; scratch: string; role: string; format: PromptFormat; ideas: Idea[]; snapshots: Snapshot[]; updated: number };
export const STORAGE_KEY = "tm-prompt-workbench-v1";

export function suggestSection(text: string): { section: SectionId; reason: string } {
  const rules: { section: SectionId; pattern: RegExp; reason: string }[] = [
    { section: "avoid", pattern: /\b(avoid|do not|don't|never|exclude|without|leave .* unchanged)\b/i, reason: "Contains a boundary or exclusion." },
    { section: "examples", pattern: /\b(for example|example:|reference|inspired by|similar to|sample)\b/i, reason: "Mentions an example or reference." },
    { section: "output", pattern: /\b(return|respond|response|output|format|json|markdown|bullet points|tone|word limit|\d+ words)\b/i, reason: "Mentions how the answer should be delivered." },
    { section: "requirements", pattern: /\b(must|need to|needs to|required|include|ensure|should|support|make sure)\b/i, reason: "Contains a requirement or expectation." },
    { section: "goal", pattern: /^(?:[-*]\s*)?(?:i want (?:you )?to|help me|your task|the goal|create|build|write|design|explain|analyze|analyse|summarize|summarise|fix|compare)\b/i, reason: "Starts with an action or desired outcome." },
  ];
  return rules.find(r => r.pattern.test(text)) ?? { section: "context", reason: "No strong keyword match; context is a starting point. Review the placement." };
}

/** Keep fenced code intact; blank lines divide thoughts, not individual sentences. */
export function splitThoughts(source: string, mode: "paragraphs" | "sentences" = "paragraphs"): string[] {
  const thoughts: string[] = []; let lines: string[] = []; let fence = "";
  for (const line of source.replace(/\r\n/g, "\n").split("\n")) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = "";
    }
    if (!line.trim() && !fence) {
      if (lines.join("\n").trim()) thoughts.push(lines.join("\n").trim()); lines = [];
    } else lines.push(line);
  }
  if (lines.join("\n").trim()) thoughts.push(lines.join("\n").trim());
  if (mode === "paragraphs") return thoughts;
  const segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });
  return thoughts.flatMap(thought => /(?:^|\n)\s*(?:`{3,}|~{3,})/.test(thought) ? [thought] : [...segmenter.segment(thought)].map(s => s.segment.trim()).filter(Boolean));
}

const normalize = (text: string) => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const stop = new Set("the a an and or to of in on for is it be this that i you my your please with as should must".split(" "));
function tokens(text: string) { return new Set(normalize(text).split(" ").filter(w => w.length > 2 && !stop.has(w))); }
export function repeatedIdeas(ideas: Idea[]) {
  const candidates = ideas.filter(i => i.included && i.text.trim() && i.section !== "inbox").slice(0, 150);
  const pairs: { a: Idea; b: Idea; exact: boolean }[] = [];
  for (let a = 0; a < candidates.length; a++) for (let b = a + 1; b < candidates.length; b++) {
    const left = candidates[a], right = candidates[b];
    const exact = normalize(left.text) === normalize(right.text);
    const x = tokens(left.text), y = tokens(right.text);
    const intersection = [...x].filter(t => y.has(t)).length;
    const similarity = intersection / Math.max(1, new Set([...x, ...y]).size);
    if (exact || (Math.min(x.size, y.size) >= 5 && similarity >= .72)) pairs.push({ a: left, b: right, exact });
    if (pairs.length >= 12) return pairs;
  }
  return pairs;
}

/** Exact sentence echoes also catch repetition inside a single long paragraph. */
export function repeatedSentences(ideas: Idea[]) {
  const seen = new Map<string, { text: string; ids: string[]; count: number }>();
  for (const idea of ideas.filter(i => i.included && i.section !== "inbox").slice(0, 150)) {
    for (const sentence of splitThoughts(idea.text, "sentences")) {
      if (sentence.includes("```") || sentence.includes("~~~")) continue;
      const key = normalize(sentence); if (key.length < 30) continue;
      const existing = seen.get(key);
      if (existing) { existing.count++; if (!existing.ids.includes(idea.id)) existing.ids.push(idea.id); }
      else seen.set(key, { text: sentence, ids: [idea.id], count: 1 });
    }
  }
  return [...seen.values()].filter(s => s.count > 1).slice(0, 10);
}

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function assemblePrompt(draft: Pick<PromptDraft, "ideas" | "role" | "format">): string {
  const output: string[] = [];
  if (draft.role.trim()) output.push(draft.format === "xml" ? `<role>${escapeXml(draft.role.trim())}</role>` : draft.format === "markdown" ? `## Role\n${draft.role.trim()}` : `Role:\n${draft.role.trim()}`);
  for (const section of SECTIONS) {
    const ideas = draft.ideas.filter(i => i.section === section.id && i.included && i.text.trim());
    if (!ideas.length) continue;
    if (draft.format === "xml") {
      output.push(`<${section.id}>\n${ideas.map(i => `  <item priority="${i.priority}">${escapeXml(i.text.trim())}</item>`).join("\n")}\n</${section.id}>`);
    } else {
      const body = ideas.map(i => `${i.priority === "preference" ? "Preference: " : section.id === "requirements" ? "Must-have: " : ""}${i.text.trim()}`).join("\n\n");
      output.push(`${draft.format === "markdown" ? `## ${section.label}` : `${section.label}:`}\n${body}`);
    }
  }
  return draft.format === "xml" && output.length ? `<prompt>\n${output.join("\n\n")}\n</prompt>` : output.join("\n\n");
}

export type ReviewFinding = { title: string; detail: string; section?: SectionId; ideaIds?: string[] };
export function reviewPrompt(draft: PromptDraft): ReviewFinding[] {
  const included = draft.ideas.filter(i => i.included && i.section !== "inbox" && i.text.trim());
  const findings: ReviewFinding[] = [];
  for (const key of ["goal", "context", "output"] as const) if (!included.some(i => i.section === key)) {
    const section = SECTIONS.find(s => s.id === key)!;
    findings.push({ title: `Add ${section.label.toLowerCase()}`, detail: section.question, section: key });
  }
  const goals = included.filter(i => i.section === "goal");
  if (goals.length > 1) findings.push({ title: "Bring the goals together", detail: "You have several goal cards. Are they one outcome, or separate requests?", section: "goal" });
  const inbox = draft.ideas.filter(i => i.section === "inbox" && i.text.trim());
  if (inbox.length) findings.push({ title: `${inbox.length} unplaced ${inbox.length === 1 ? "idea" : "ideas"}`, detail: "Inbox ideas are not part of the final prompt. Place them or keep them for later." });
  const vague = included.filter(i => /\b(good|better|beautiful|professional|creative|perfect|user.?friendly|best)\b/i.test(i.text));
  if (vague.length) findings.push({ title: "Make subjective words concrete", detail: "Words like “better” or “professional” need a reference or observable criteria. What would success look like?", ideaIds: vague.map(i => i.id) });
  const all = included.map(i => i.text).join("\n");
  for (const [positive, negative, detail] of [
    [/\b(?:use|include|add) (?:an? )?(?:[^.\n]{0,20} )?animations?\b/i, /\b(?:no animations?|avoid animations?|without animations?|do not (?:use|add) animations?)\b/i, "Some cards request animation while others exclude it."],
    [/\b(?:detailed|comprehensive|in.depth)\b/i, /\b(?:one sentence|single sentence|under 50 words)\b/i, "A detailed answer may conflict with the short length you requested."],
  ] as const) if (splitThoughts(all, "sentences").some(sentence => positive.test(sentence) && !negative.test(sentence)) && negative.test(all)) findings.push({ title: "Check a possible tension", detail: `${detail} These keyword checks need your judgment.` });
  if (included.some(i => i.text.length > 1800)) findings.push({ title: "Give a long idea more structure", detail: "A card has over 1,800 characters. Breaking it into focused ideas could make the request easier to follow." });
  return findings;
}

export const TEMPLATE_DATA: { name: string; description: string; role: string; ideas: { text: string; section: SectionId }[] }[] = [
  { name: "Blank canvas", description: "Start with your own thoughts.", role: "", ideas: [] },
  { name: "Build a feature", description: "Turn an idea into a development brief.", role: "Act as a thoughtful software engineer.", ideas: [
    { section: "goal", text: "Build [feature] so [audience] can [desired outcome]." },
    { section: "context", text: "The project uses [stack]. Existing behavior: [describe it]." },
    { section: "requirements", text: "Include [key behaviors]. Handle [important edge cases]." },
    { section: "output", text: "Implement the change, explain the important choices, and report the checks you ran." },
    { section: "avoid", text: "Keep unrelated functionality unchanged. Do not add dependencies without explaining why." },
  ] },
  { name: "Write something", description: "Audience, voice and a clear deliverable.", role: "Act as an editor who writes clear, useful copy.", ideas: [
    { section: "goal", text: "Write [content type] about [topic] for [audience]." },
    { section: "context", text: "The reader knows [background] and needs help with [problem]." },
    { section: "requirements", text: "Cover [main points]. Support claims with [provided facts or sources]." },
    { section: "output", text: "Use [tone]. Aim for [length]. Deliver [format]." },
    { section: "avoid", text: "Avoid filler and unsupported claims." },
  ] },
  { name: "Research a decision", description: "Evidence and trade-offs before conclusions.", role: "Act as a careful research partner.", ideas: [
    { section: "goal", text: "Compare [options] to help me decide [decision]." },
    { section: "context", text: "My situation: [background]. Budget: [budget]. Priorities: [priorities]." },
    { section: "requirements", text: "Compare [criteria]. Distinguish verified facts from assumptions and identify missing information." },
    { section: "output", text: "Provide a comparison table, supporting sources, trade-offs, and a recommendation with reasons." },
  ] },
  { name: "Design a screen", description: "Purpose, visual direction and interactions.", role: "Act as a product designer.", ideas: [
    { section: "goal", text: "Design [screen] to help [users] accomplish [task]." },
    { section: "context", text: "Brand direction: [describe]. Existing product: [describe]." },
    { section: "requirements", text: "Include [elements]. Explain empty, loading and error states. Consider mobile and keyboard access." },
    { section: "examples", text: "Reference: [link or description]. What I like: [specific qualities]." },
    { section: "output", text: "Deliver [mockup, implementation or specification] and explain the layout choices." },
  ] },
];

export function newDraft(id: string, template = 0): PromptDraft {
  const data = TEMPLATE_DATA[template] ?? TEMPLATE_DATA[0];
  return { id, title: template ? data.name : "Untitled prompt", scratch: "", role: data.role, format: "markdown", ideas: data.ideas.map((i, index) => ({ ...i, id: `${id}-${index}`, included: true, priority: "essential" })), snapshots: [], updated: Date.now() };
}

function isIdea(value: unknown): value is Idea {
  if (!value || typeof value !== "object") return false;
  const v = value as Idea;
  return typeof v.id === "string" && typeof v.text === "string" && (v.section === "inbox" || SECTIONS.some(s => s.id === v.section)) && ["essential", "preference"].includes(v.priority) && typeof v.included === "boolean";
}
function isFormat(v: unknown) { return v === "markdown" || v === "plain" || v === "xml"; }
export function validDrafts(value: unknown): value is PromptDraft[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 200 && new Set(value.map(d => d?.id)).size === value.length && value.every(d =>
    d && typeof d.id === "string" && typeof d.title === "string" && typeof d.scratch === "string" && typeof d.role === "string" && isFormat(d.format) && Number.isFinite(d.updated) &&
    Array.isArray(d.ideas) && d.ideas.length <= 1000 && d.ideas.every(isIdea) && new Set(d.ideas.map((i: Idea) => i.id)).size === d.ideas.length &&
    Array.isArray(d.snapshots) && d.snapshots.length <= 30 && d.snapshots.every((s: Snapshot) => s && typeof s.id === "string" && typeof s.name === "string" && Number.isFinite(s.date) && typeof s.scratch === "string" && typeof s.role === "string" && isFormat(s.format) && Array.isArray(s.ideas) && s.ideas.length <= 1000 && s.ideas.every(isIdea))
  );
}
