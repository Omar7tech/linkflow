"use client";

import * as React from "react";
import { FingerprintIcon, SparklesIcon, TypeIcon, WandSparklesIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  analyze,
  BRAND_DIMENSIONS,
  BRAND_EXAMPLES,
  BRAND_RECS,
  DIMENSION_BY_ID,
  polarPoint,
  radarPolygon,
  ranked,
  segment,
  summarize,
  toMarkdown,
  type Analysis,
  type BrandScores,
} from "@/lib/brand";

export function BrandTool() {
  const [text, setText] = React.useState(BRAND_EXAMPLES[0].text);
  const analysis = React.useMemo(() => analyze(text), [text]);
  const hasMatches = analysis.matches > 0;
  const dominant = ranked(analysis.scores)[0];
  const rec = BRAND_RECS[dominant.id];

  return (
    <GeneratorLayout tool={TOOL_BY_ID.brand} output={<ProfilePanel analysis={analysis} />}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <WandSparklesIcon className="text-primary size-4" />
              Your brand copy
            </CardTitle>
            <CardDescription>
              Paste a tagline, mission or any marketing copy. We read the language and map the
              personality it actually projects — no manual guessing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Crafted by hand, built to last…"
              className="min-h-32 resize-y leading-relaxed"
              aria-label="Brand copy"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium">Try:</span>
              {BRAND_EXAMPLES.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => setText(ex.text)}
                  className="border-border/60 hover:border-primary h-8 rounded-lg border px-2.5 text-xs font-bold transition-colors"
                >
                  {ex.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setText("")}
                className="text-muted-foreground hover:text-foreground ml-auto h-8 px-2 text-xs"
              >
                Clear
              </button>
            </div>
            <p className="text-muted-foreground text-xs">
              {analysis.words} words · <span className="text-foreground font-semibold">{analysis.matches}</span>{" "}
              personality signals found
            </p>
          </CardContent>
        </Card>

        {/* Evidence — the "why", highlighted in the copy itself */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SparklesIcon className="text-primary size-4" />
              What drove the result
            </CardTitle>
            <CardDescription>
              Every word that signalled a dimension, highlighted in its color.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasMatches ? (
              <>
                <p className="leading-loose">
                  {segment(text).map((seg, i) =>
                    seg.dim ? (
                      <mark
                        key={i}
                        className="rounded px-1 py-0.5 font-medium"
                        style={{
                          backgroundColor: DIMENSION_BY_ID[seg.dim].color + "26",
                          color: DIMENSION_BY_ID[seg.dim].color,
                        }}
                      >
                        {seg.text}
                      </mark>
                    ) : (
                      <span key={i}>{seg.text}</span>
                    )
                  )}
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  {BRAND_DIMENSIONS.filter((d) => analysis.evidence[d.id].length > 0).map((d) => (
                    <div key={d.id} className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-xs font-semibold">{d.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {analysis.evidence[d.id].reduce((n, e) => n + e.count, 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No personality signals yet — paste a sentence or two of brand copy above.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Design kit for the dominant dimension */}
        {hasMatches && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TypeIcon className="text-primary size-4" />
                Design kit · {dominant.name}
              </CardTitle>
              <CardDescription>{rec.tip}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs">Palette</Label>
                <div className="flex gap-2">
                  {rec.palette.map((hex) => (
                    <div key={hex} className="flex-1 space-y-1">
                      <div className="border-border/40 h-12 rounded-lg border" style={{ backgroundColor: hex }} />
                      <p className="text-muted-foreground text-center font-mono text-[9px] uppercase">
                        {hex.replace("#", "")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <KitRow label="Headings" value={rec.fonts.heading} />
                <KitRow label="Body" value={rec.fonts.body} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Voice &amp; tone</Label>
                <div className="flex flex-wrap gap-1.5">
                  {rec.voice.map((w) => (
                    <span
                      key={w}
                      className="border-border/60 bg-muted/40 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">In good company</Label>
                <p className="text-muted-foreground text-sm">{rec.brands.join(" · ")}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </GeneratorLayout>
  );
}

function KitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/60 rounded-lg border px-3 py-2">
      <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

/* ------------------------------ Radar + profile ---------------------------- */

function ProfilePanel({ analysis }: { analysis: Analysis }) {
  const { scores, matches } = analysis;
  const order = ranked(scores);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FingerprintIcon className="text-primary size-4" />
          Personality map
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <RadarChart scores={scores} dim={matches > 0} />

        <div className="space-y-1.5">
          {matches > 0 && (
            <p className="flex items-center gap-2 text-sm">
              <SparklesIcon className="text-primary size-4 shrink-0" />
              <span>
                <span className="font-semibold">{order[0].name}</span>
                <span className="text-muted-foreground"> dominant, </span>
                <span className="font-semibold">{order[1].name}</span>
                <span className="text-muted-foreground"> secondary</span>
              </span>
            </p>
          )}
          <p className="text-muted-foreground text-sm leading-relaxed">{summarize(scores, matches)}</p>
        </div>

        <div className="space-y-1.5">
          {order.map((d) => (
            <div key={d.id} className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-xs font-medium">{d.name}</span>
              <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${scores[d.id]}%`, backgroundColor: d.color }}
                />
              </div>
              <span className="w-7 shrink-0 text-right font-mono text-[11px] tabular-nums">
                {scores[d.id]}
              </span>
            </div>
          ))}
        </div>

        <CopyButton
          text={toMarkdown(scores, matches)}
          label="Copy profile"
          variant="outline"
          className="w-full"
          successMessage="Profile copied as Markdown"
          disabled={matches === 0}
        />
      </CardContent>
    </Card>
  );
}

function RadarChart({ scores, dim }: { scores: BrandScores; dim: boolean }) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const r = 84;
  const total = BRAND_DIMENSIONS.length;
  const dominant = ranked(scores)[0];
  const accent = dim ? dominant.color : "#94a3b8";
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto w-full max-w-[260px]"
      role="img"
      aria-label="Brand personality radar chart"
    >
      {rings.map((frac) => (
        <polygon
          key={frac}
          points={BRAND_DIMENSIONS.map((_, i) => {
            const p = polarPoint(i, total, frac, cx, cy, r);
            return `${p.x},${p.y}`;
          }).join(" ")}
          className="fill-none stroke-border"
          strokeWidth={1}
        />
      ))}
      {BRAND_DIMENSIONS.map((d, i) => {
        const p = polarPoint(i, total, 1, cx, cy, r);
        return <line key={d.id} x1={cx} y1={cy} x2={p.x} y2={p.y} className="stroke-border" strokeWidth={1} />;
      })}
      {dim && (
        <polygon
          points={radarPolygon(scores, cx, cy, r)}
          style={{ fill: accent + "33", stroke: accent }}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      )}
      {BRAND_DIMENSIONS.map((d, i) => {
        const vertex = polarPoint(i, total, scores[d.id] / 100, cx, cy, r);
        const label = polarPoint(i, total, 1.2, cx, cy, r);
        return (
          <g key={d.id}>
            {dim && scores[d.id] > 0 && (
              <circle cx={vertex.x} cy={vertex.y} r={3} style={{ fill: d.color }} />
            )}
            <text
              x={label.x}
              y={label.y}
              textAnchor={label.x < cx - 4 ? "end" : label.x > cx + 4 ? "start" : "middle"}
              dominantBaseline="middle"
              className="fill-muted-foreground text-[9px] font-medium"
            >
              {d.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
