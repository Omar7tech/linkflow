"use client";

import * as React from "react";
import {
  AlertTriangleIcon,
  ArrowUpRightIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  Clock3Icon,
  Code2Icon,
  DownloadIcon,
  GaugeIcon,
  Globe2Icon,
  ImageIcon,
  Link2Icon,
  LoaderCircleIcon,
  RadarIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TextIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  AUDIT_CATEGORY_LABELS,
  type AuditCategory,
  type AuditCheck,
  type AuditStatus,
  type LaunchReadyResult,
} from "@/lib/launch-ready";
import { cn } from "@/lib/utils";

const EXAMPLES = ["web.dev", "stripe.com", "developer.mozilla.org"];
const QUOTA_KEY = "forma:launch-ready:uses";
const DAILY_LIMIT = 30;

const CATEGORY_ICONS: Record<AuditCategory, typeof SearchIcon> = {
  seo: SearchIcon,
  accessibility: CircleDotIcon,
  security: ShieldCheckIcon,
  performance: GaugeIcon,
  content: TextIcon,
};

const STATUS_COPY: Record<AuditStatus, { label: string; icon: typeof CheckCircle2Icon }> = {
  critical: { label: "Fix first", icon: TriangleAlertIcon },
  warning: { label: "Improve", icon: AlertTriangleIcon },
  passed: { label: "Passed", icon: CheckCircle2Icon },
};

function consumeDailyUse(): boolean {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const stored = JSON.parse(localStorage.getItem(QUOTA_KEY) ?? "null") as {
      date?: string;
      count?: number;
    } | null;
    const count = stored?.date === today ? (stored.count ?? 0) : 0;
    if (count >= DAILY_LIMIT) return false;
    localStorage.setItem(QUOTA_KEY, JSON.stringify({ date: today, count: count + 1 }));
    return true;
  } catch {
    return true;
  }
}

export function LaunchReadyTool() {
  const [url, setUrl] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<LaunchReadyResult | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const scan = async (target = url) => {
    const trimmed = target.trim();
    if (!trimmed) return;
    if (!consumeDailyUse()) {
      toast.error(`Daily scan limit reached (${DAILY_LIMIT}). Try again tomorrow.`);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const response = await fetch("/api/launch-ready", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
        signal: controller.signal,
      });
      const data = (await response.json()) as LaunchReadyResult & { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "That site could not be scanned.");
        return;
      }
      React.startTransition(() => setResult(data));
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        toast.error("The scan was interrupted. Please try again.");
      }
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.launchready}
      output={null}
      footer={<Methodology />}
    >
      <div className="flex flex-col gap-6">
        <Card className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                "linear-gradient(to right, color-mix(in oklab, var(--border) 55%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 55%, transparent) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              maskImage: "linear-gradient(to right, black, transparent 75%)",
            }}
            aria-hidden
          />
          <CardHeader className="relative border-b">
            <Badge variant="outline" className="mb-2 font-mono uppercase tracking-[0.18em]">
              <RadarIcon data-icon="inline-start" /> Preflight scanner
            </Badge>
            <CardTitle className="font-heading max-w-2xl text-2xl tracking-tight sm:text-3xl">
              Find the launch blockers hiding in plain sight.
            </CardTitle>
            <CardDescription className="max-w-2xl text-base">
              One scan checks search, accessibility, trust, speed, and content, then tells you
              exactly what to fix first.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative flex flex-col gap-4 pt-2">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void scan();
              }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <label className="sr-only" htmlFor="launch-ready-url">
                Website URL
              </label>
              <InputGroup className="h-11 flex-1 bg-background/85 shadow-sm">
                <InputGroupAddon>
                  <Globe2Icon aria-hidden />
                </InputGroupAddon>
                <InputGroupInput
                  id="launch-ready-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="yourwebsite.com"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                />
              </InputGroup>
              <Button type="submit" size="lg" disabled={loading || !url.trim()}>
                {loading ? (
                  <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
                ) : (
                  <SparklesIcon data-icon="inline-start" />
                )}
                {loading ? "Running preflight" : "Check launch readiness"}
              </Button>
            </form>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs">Try a public site:</span>
              {EXAMPLES.map((example) => (
                <Button
                  key={example}
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="font-mono"
                  disabled={loading}
                  onClick={() => {
                    setUrl(example);
                    void scan(example);
                  }}
                >
                  {example}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {loading && <ScanningState />}
        {!loading && result && <AuditReport result={result} onRescan={() => void scan(result.site.url)} />}
        {!loading && !result && <EmptyPreflight />}
      </div>
    </GeneratorLayout>
  );
}

function ScanningState() {
  const [step, setStep] = React.useState(0);
  const steps = ["Reading the page", "Checking launch signals", "Asking public auditors", "Prioritizing fixes"];

  React.useEffect(() => {
    const id = window.setInterval(() => setStep((current) => Math.min(current + 1, steps.length - 1)), 1800);
    return () => window.clearInterval(id);
  }, [steps.length]);

  return (
    <Card aria-live="polite">
      <CardContent className="flex min-h-48 flex-col items-center justify-center gap-5 text-center">
        <div className="relative flex size-16 items-center justify-center rounded-full border bg-muted/35">
          <RadarIcon className="text-primary size-7 animate-pulse" aria-hidden />
          <span className="border-primary/40 absolute inset-1 animate-ping rounded-full border" aria-hidden />
        </div>
        <div>
          <p className="font-heading text-lg font-medium">{steps[step]}</p>
          <p className="text-muted-foreground mt-1 text-sm">Public performance checks can take a few seconds.</p>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {steps.map((item, index) => (
            <span
              key={item}
              className={cn("h-1.5 w-8 rounded-full transition-colors", index <= step ? "bg-primary" : "bg-muted")}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyPreflight() {
  const items = [
    { icon: SearchIcon, title: "Search", text: "Titles, descriptions, sharing cards, crawlers" },
    { icon: CircleDotIcon, title: "Access", text: "Language, labels, image descriptions, mobile setup" },
    { icon: ShieldCheckIcon, title: "Trust", text: "HTTPS, safe links, browser security headers" },
    { icon: GaugeIcon, title: "Speed", text: "Response time, HTML weight, mobile performance" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <Card key={item.title} size="sm" className="animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${index * 70}ms` }}>
          <CardHeader>
            <item.icon className="text-primary size-5" aria-hidden />
            <CardTitle>{item.title}</CardTitle>
            <CardDescription>{item.text}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function AuditReport({ result, onRescan }: { result: LaunchReadyResult; onRescan: () => void }) {
  const critical = result.checks.filter((check) => check.status === "critical").length;
  const warnings = result.checks.filter((check) => check.status === "warning").length;
  const passed = result.checks.filter((check) => check.status === "passed").length;
  const summary = buildSummary(result);

  const download = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${result.site.host.replace(/[^a-z0-9.-]/gi, "-")}-launch-audit.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="animate-in flex flex-col gap-5 fade-in slide-in-from-bottom-3 duration-500">
      <Card className="overflow-visible">
        <CardHeader className="border-b">
          <div className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- unknown remote favicon host */}
            <img
              src={result.site.faviconUrl}
              alt=""
              className="bg-muted size-9 rounded-lg border object-contain p-1"
              onError={(event) => (event.currentTarget.style.display = "none")}
            />
            <div className="min-w-0">
              <CardTitle className="truncate">{result.site.title ?? result.site.host}</CardTitle>
              <CardDescription className="truncate font-mono text-xs">{result.site.url}</CardDescription>
            </div>
          </div>
          <CardAction className="flex items-center gap-1">
            <CopyButton text={summary} label="Copy report" variant="outline" size="sm" />
            <Button variant="ghost" size="icon-sm" onClick={download} aria-label="Download audit JSON">
              <DownloadIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onRescan} aria-label="Run scan again">
              <RefreshCwIcon />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-6 pt-2 lg:grid-cols-[240px_1fr]">
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-muted/30 p-5 text-center">
            <ScoreDial score={result.score} />
            <div>
              <p className="font-heading text-xl font-semibold">{result.verdict}</p>
              <p className="text-muted-foreground mt-1 text-xs">Overall launch readiness</p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {critical > 0 && <Badge variant="destructive">{critical} fix first</Badge>}
              {warnings > 0 && <Badge variant="secondary">{warnings} improve</Badge>}
              <Badge variant="outline">{passed} passed</Badge>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {result.categories.map((category) => {
                const Icon = CATEGORY_ICONS[category.id];
                return (
                  <div key={category.id} className="rounded-xl border bg-background p-3">
                    <div className="text-muted-foreground flex items-center justify-between">
                      <Icon className="size-4" aria-hidden />
                      <span className="font-mono text-lg font-semibold text-foreground">{category.score}</span>
                    </div>
                    <p className="mt-2 text-xs font-medium">{category.label}</p>
                    <div className="bg-muted mt-2 h-1 overflow-hidden rounded-full">
                      <div className="bg-primary h-full rounded-full" style={{ width: `${category.score}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 border-t pt-4 font-mono text-xs">
              <span className="flex items-center gap-1.5"><Clock3Icon className="size-3.5" /> {result.site.responseMs} ms</span>
              <span className="flex items-center gap-1.5"><Code2Icon className="size-3.5" /> {result.site.pageKb} KB HTML</span>
              <span className="flex items-center gap-1.5"><Link2Icon className="size-3.5" /> {result.facts.links} links</span>
              <span className="flex items-center gap-1.5"><ImageIcon className="size-3.5" /> {result.facts.images} images</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={critical ? "critical" : warnings ? "warning" : "passed"}>
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="critical">Fix first <Badge variant="destructive">{critical}</Badge></TabsTrigger>
          <TabsTrigger value="warning">Improve <Badge variant="secondary">{warnings}</Badge></TabsTrigger>
          <TabsTrigger value="passed">Passed <Badge variant="outline">{passed}</Badge></TabsTrigger>
          <TabsTrigger value="all">All checks</TabsTrigger>
        </TabsList>
        <TabsContent value="critical"><CheckList checks={result.checks.filter((check) => check.status === "critical")} empty="No launch blockers found." /></TabsContent>
        <TabsContent value="warning"><CheckList checks={result.checks.filter((check) => check.status === "warning")} empty="Nothing else needs attention." /></TabsContent>
        <TabsContent value="passed"><CheckList checks={result.checks.filter((check) => check.status === "passed")} empty="No passing checks yet." /></TabsContent>
        <TabsContent value="all"><CheckList checks={result.checks} empty="No checks returned." /></TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3 text-xs">
        <p className="text-muted-foreground">
          Enrichment: PageSpeed {serviceWord(result.services.pagespeed)}, MDN Observatory {serviceWord(result.services.observatory)}, W3C {serviceWord(result.services.validator)}.
        </p>
        <Button asChild variant="ghost" size="xs">
          <a href={result.site.url} target="_blank" rel="noopener noreferrer">
            Open website <ArrowUpRightIcon data-icon="inline-end" />
          </a>
        </Button>
      </div>
    </div>
  );
}

function ScoreDial({ score }: { score: number }) {
  return (
    <div
      className="relative grid size-36 place-items-center rounded-full"
      style={{ background: `conic-gradient(var(--primary) ${score * 3.6}deg, var(--muted) 0deg)` }}
      role="img"
      aria-label={`Launch readiness score: ${score} out of 100`}
    >
      <div className="bg-card grid size-28 place-items-center rounded-full shadow-inner">
        <div>
          <span className="font-heading text-4xl font-bold tracking-tighter">{score}</span>
          <span className="text-muted-foreground text-xs">/100</span>
        </div>
      </div>
    </div>
  );
}

function CheckList({ checks, empty }: { checks: AuditCheck[]; empty: string }) {
  if (!checks.length) {
    return (
      <Card className="mt-3" size="sm">
        <CardContent className="text-muted-foreground flex min-h-28 items-center justify-center gap-2 text-sm">
          <CheckCircle2Icon className="text-primary size-5" /> {empty}
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      {checks.map((check) => <CheckCard key={check.id} check={check} />)}
    </div>
  );
}

function CheckCard({ check }: { check: AuditCheck }) {
  const { label, icon: Icon } = STATUS_COPY[check.status];
  return (
    <Card size="sm" className={cn(check.status === "critical" && "ring-destructive/35")}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className={cn("grid size-8 place-items-center rounded-lg bg-muted", check.status === "critical" && "bg-destructive/10 text-destructive", check.status === "passed" && "bg-primary/10 text-primary")}>
            <Icon className="size-4" aria-hidden />
          </span>
          <div>
            <CardTitle>{check.title}</CardTitle>
            <CardDescription>{AUDIT_CATEGORY_LABELS[check.category]}</CardDescription>
          </div>
        </div>
        <CardAction>
          <Badge variant={check.status === "critical" ? "destructive" : check.status === "passed" ? "outline" : "secondary"}>{label}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed">{check.summary}</p>
        {check.fix && (
          <div className="rounded-lg border bg-muted/35 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">Suggested fix</span>
              <CopyButton text={check.fix} label="" variant="ghost" size="icon-xs" aria-label={`Copy fix for ${check.title}`} />
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">{check.fix}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Methodology() {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>What this scan can and cannot tell you</CardTitle>
        <CardDescription>
          LaunchReady reads public page markup and headers, then optionally enriches the audit with public services. It is a practical preflight, not a penetration test or a replacement for testing with real assistive technology.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function serviceWord(status: "available" | "unavailable") {
  return status === "available" ? "included" : "rate-limited";
}

function buildSummary(result: LaunchReadyResult): string {
  const issues = result.checks.filter((check) => check.status !== "passed");
  return [
    `LaunchReady audit: ${result.site.host}`,
    `Score: ${result.score}/100 - ${result.verdict}`,
    "",
    ...issues.map((check) => `[${STATUS_COPY[check.status].label}] ${check.title}: ${check.summary}`),
  ].join("\n");
}

