"use client";

import * as React from "react";
import { BookOpenIcon, MicIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/shared/copy-button";
import { Field } from "@/components/shared/field";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  analyzeText,
  formatDuration,
  readLabel,
  readability,
  readingSeconds,
  speakingSeconds,
} from "@/lib/readingTime";

const READING_PRESETS = [
  { label: "Careful", wpm: 150 },
  { label: "Average", wpm: 225 },
  { label: "Fast", wpm: 300 },
  { label: "Skimming", wpm: 450 },
];

const SPEAKING_PRESETS = [
  { label: "Presentation", wpm: 120 },
  { label: "Conversational", wpm: 150 },
  { label: "Podcast", wpm: 170 },
];

export function ReadtimeTool() {
  const [text, setText] = React.useState("");
  const [readingWpm, setReadingWpm] = React.useState(225);
  const [speakingWpm, setSpeakingWpm] = React.useState(150);
  const [images, setImages] = React.useState(0);

  const stats = React.useMemo(() => analyzeText(text), [text]);
  const score = React.useMemo(() => readability(text), [text]);
  const readSecs = readingSeconds(stats.words, readingWpm, images);
  const speakSecs = speakingSeconds(stats.words, speakingWpm);
  const hasText = stats.words > 0;

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.readtime}
      output={
        <Card aria-live="polite">
          <CardHeader>
            <CardTitle className="text-base">Your estimate</CardTitle>
            <CardDescription>
              {hasText ? "Live — updates as you type or tweak speeds." : "Paste some text to analyze it."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-muted/50 border-border rounded-lg border p-3">
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <BookOpenIcon className="size-3.5" aria-hidden /> Reading · {readingWpm} wpm
                </div>
                <div className="mt-1 text-xl font-semibold tabular-nums">
                  {hasText ? formatDuration(readSecs) : "—"}
                </div>
              </div>
              <div className="bg-muted/50 border-border rounded-lg border p-3">
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <MicIcon className="size-3.5" aria-hidden /> Speaking · {speakingWpm} wpm
                </div>
                <div className="mt-1 text-xl font-semibold tabular-nums">
                  {hasText ? formatDuration(speakSecs) : "—"}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-mono">
                {hasText ? readLabel(readSecs) : "1 min read"}
              </Badge>
              <CopyButton
                text={readLabel(readSecs)}
                disabled={!hasText}
                label="Copy badge"
                variant="outline"
                size="sm"
                successMessage="Read-time badge copied"
              />
              <CopyButton
                text={[
                  `Words: ${stats.words}`,
                  `Characters: ${stats.characters}`,
                  `Sentences: ${stats.sentences}`,
                  `Reading time: ${formatDuration(readSecs)} (${readingWpm} wpm)`,
                  `Speaking time: ${formatDuration(speakSecs)} (${speakingWpm} wpm)`,
                  score ? `Readability: Flesch ${score.ease} (grade ${score.grade})` : null,
                ]
                  .filter(Boolean)
                  .join("\n")}
                disabled={!hasText}
                label="Copy report"
                variant="outline"
                size="sm"
                successMessage="Full report copied"
              />
            </div>

            <Separator />

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {(
                [
                  ["Words", stats.words],
                  ["Characters", stats.characters],
                  ["No spaces", stats.charactersNoSpaces],
                  ["Sentences", stats.sentences],
                  ["Paragraphs", stats.paragraphs],
                  ["Avg words/sentence", stats.sentences > 0 ? Math.round(stats.words / stats.sentences) : 0],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground text-xs">{label}</dt>
                  <dd className="font-mono text-xs tabular-nums">{value.toLocaleString()}</dd>
                </div>
              ))}
            </dl>

            {hasText && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs font-medium">Fits within</p>
                  {(
                    [
                      ["X / Twitter post", 280],
                      ["Meta description", 160],
                      ["Instagram caption", 2200],
                      ["LinkedIn post", 3000],
                    ] as const
                  ).map(([name, limit]) => {
                    const fits = stats.characters <= limit;
                    return (
                      <div key={name} className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">{name}</span>
                        <span
                          className={
                            fits
                              ? "font-mono text-emerald-600 dark:text-emerald-400"
                              : "text-destructive/80 font-mono"
                          }
                        >
                          {fits ? "✓" : `+${(stats.characters - limit).toLocaleString()}`}{" "}
                          <span className="text-muted-foreground">/ {limit.toLocaleString()}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {score && (
              <>
                <Separator />
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{score.easeLabel}</span>
                    <span className="text-muted-foreground text-xs">
                      Flesch ease {score.ease} · grade {score.grade}
                    </span>
                  </div>
                  <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${score.ease}%` }}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Higher is easier to read — most web writing aims for 60+.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      }
    >
      <Card>
        <CardContent className="space-y-6">
          <Field
            label="Your text"
            htmlFor="rt-text"
            hint="Nothing fancy needed — paste a draft, an article or a script."
          >
            <Textarea
              id="rt-text"
              rows={12}
              placeholder="Paste your article, blog post, speech or script here…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Reading speed</Label>
              <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs tabular-nums">{readingWpm} wpm</span>
            </div>
            <Slider
              value={[readingWpm]}
              min={100}
              max={500}
              step={5}
              onValueChange={([v]) => setReadingWpm(v)}
              aria-label="Reading speed in words per minute"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {READING_PRESETS.map((preset) => (
                <Badge
                  key={preset.label}
                  asChild
                  variant={readingWpm === preset.wpm ? "default" : "outline"}
                  className="cursor-pointer"
                >
                  <button type="button" onClick={() => setReadingWpm(preset.wpm)}>
                    {preset.label} · {preset.wpm}
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Speaking speed</Label>
              <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs tabular-nums">{speakingWpm} wpm</span>
            </div>
            <Slider
              value={[speakingWpm]}
              min={90}
              max={220}
              step={5}
              onValueChange={([v]) => setSpeakingWpm(v)}
              aria-label="Speaking speed in words per minute"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SPEAKING_PRESETS.map((preset) => (
                <Badge
                  key={preset.label}
                  asChild
                  variant={speakingWpm === preset.wpm ? "default" : "outline"}
                  className="cursor-pointer"
                >
                  <button type="button" onClick={() => setSpeakingWpm(preset.wpm)}>
                    {preset.label} · {preset.wpm}
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <Field
            label="Images in the piece"
            htmlFor="rt-images"
            optional
            hint="Medium's formula: 12s for the first image, a second less for each after, 3s minimum."
          >
            <Input
              id="rt-images"
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              className="w-28"
              value={images}
              onChange={(e) => setImages(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            />
          </Field>
        </CardContent>
      </Card>
    </GeneratorLayout>
  );
}
